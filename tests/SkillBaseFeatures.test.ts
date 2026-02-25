import { describe, it, expect } from 'vitest';
import { SkillBase, type SkillManifest, type SkillToolDefinition, type SkillConfig, type ParameterSchemaEntry } from '../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';

/** Minimal concrete skill for testing base features. */
class TestSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('test_skill', config);
  }

  getManifest(): SkillManifest {
    return { name: 'test_skill', description: 'A test skill', version: '1.0.0' };
  }

  getTools(): SkillToolDefinition[] {
    return [{
      name: 'test_tool',
      description: 'A test tool',
      handler: () => new SwaigFunctionResult('ok'),
    }];
  }

  protected override _getPromptSections() {
    return [{ title: 'Test Section', body: 'test body', bullets: ['bullet1'] }];
  }
}

describe('SkillBase Features', () => {
  describe('getParameterSchema', () => {
    it('base returns swaig_fields and skip_prompt', () => {
      const schema = SkillBase.getParameterSchema();
      expect(schema).toHaveProperty('swaig_fields');
      expect(schema).toHaveProperty('skip_prompt');
      expect(schema.swaig_fields.type).toBe('object');
      expect(schema.skip_prompt.type).toBe('boolean');
      expect(schema.skip_prompt.default).toBe(false);
    });

    it('TestSkill inherits base schema', () => {
      const schema = TestSkill.getParameterSchema();
      expect(schema).toHaveProperty('swaig_fields');
      expect(schema).toHaveProperty('skip_prompt');
    });
  });

  describe('swaigFields extraction', () => {
    it('extracts swaig_fields from config', () => {
      const skill = new TestSkill({ swaig_fields: { wait_file: 'hold.mp3' } });
      expect(skill.swaigFields).toEqual({ wait_file: 'hold.mp3' });
      // swaig_fields should be removed from config
      expect(skill.getConfig('swaig_fields')).toBeUndefined();
    });

    it('defaults to empty object when not provided', () => {
      const skill = new TestSkill();
      expect(skill.swaigFields).toEqual({});
    });

    it('preserves other config after extraction', () => {
      const skill = new TestSkill({ swaig_fields: { x: 1 }, other_key: 'value' });
      expect(skill.getConfig('other_key')).toBe('value');
    });
  });

  describe('skip_prompt', () => {
    it('returns prompt sections when skip_prompt is false', () => {
      const skill = new TestSkill();
      const sections = skill.getPromptSections();
      expect(sections.length).toBe(1);
      expect(sections[0].title).toBe('Test Section');
    });

    it('returns empty when skip_prompt is true', () => {
      const skill = new TestSkill({ skip_prompt: true });
      const sections = skill.getPromptSections();
      expect(sections).toEqual([]);
    });
  });

  describe('getInstanceKey', () => {
    it('default returns skillName', () => {
      const skill = new TestSkill();
      expect(skill.getInstanceKey()).toBe('test_skill');
    });
  });

  describe('getSkillNamespace', () => {
    it('default returns skill:<skillName>', () => {
      const skill = new TestSkill();
      expect(skill.getSkillNamespace()).toBe('skill:test_skill');
    });

    it('uses prefix config if provided', () => {
      const skill = new TestSkill({ prefix: 'my_prefix' });
      expect(skill.getSkillNamespace()).toBe('skill:my_prefix');
    });
  });

  describe('getSkillData', () => {
    it('reads from rawData global_data', () => {
      const skill = new TestSkill();
      const rawData = { global_data: { 'skill:test_skill': { count: 5 } } };
      expect(skill.getSkillData(rawData)).toEqual({ count: 5 });
    });

    it('returns empty object when no global_data', () => {
      const skill = new TestSkill();
      expect(skill.getSkillData({})).toEqual({});
    });

    it('returns empty object when namespace not in global_data', () => {
      const skill = new TestSkill();
      const rawData = { global_data: { other: 'data' } };
      expect(skill.getSkillData(rawData)).toEqual({});
    });
  });

  describe('updateSkillData', () => {
    it('calls updateGlobalData with namespaced key', () => {
      const skill = new TestSkill();
      const result = new SwaigFunctionResult('test');
      const updated = skill.updateSkillData(result, { count: 10 });
      expect(updated).toBe(result);
      const dict = result.toDict();
      // Should have set_global_data action
      const actions = dict.action as unknown[];
      expect(actions).toBeDefined();
      const setGlobalAction = actions.find(
        (a: any) => a.set_global_data !== undefined,
      ) as any;
      expect(setGlobalAction).toBeDefined();
      expect(setGlobalAction.set_global_data).toEqual({ 'skill:test_skill': { count: 10 } });
    });
  });
});
