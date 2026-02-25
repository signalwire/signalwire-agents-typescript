import { describe, it, expect } from 'vitest';
import { SkillBase, type SkillManifest, type SkillToolDefinition } from '../../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../../src/SwaigFunctionResult.js';

class TestSkill extends SkillBase {
  constructor(config?: Record<string, unknown>) {
    super('test_skill', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'test_skill',
      description: 'A test skill',
      version: '1.0.0',
      tags: ['test'],
      requiredEnvVars: ['TEST_API_KEY'],
    };
  }

  getTools(): SkillToolDefinition[] {
    return [{
      name: 'test_tool',
      description: 'A test tool',
      parameters: { query: { type: 'string' } },
      handler: (args) => new SwaigFunctionResult(`Result: ${args['query']}`),
    }];
  }

  getPromptSections() {
    return [{ title: 'Test Section', body: 'Test body' }];
  }

  getHints() {
    return ['test hint'];
  }

  getGlobalData() {
    return { test_key: 'test_value' };
  }
}

describe('SkillBase', () => {
  it('has a skill name and instance ID', () => {
    const skill = new TestSkill();
    expect(skill.skillName).toBe('test_skill');
    expect(skill.instanceId).toContain('test_skill-');
  });

  it('returns manifest', () => {
    const skill = new TestSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('test_skill');
    expect(manifest.version).toBe('1.0.0');
  });

  it('returns tools', () => {
    const skill = new TestSkill();
    const tools = skill.getTools();
    expect(tools.length).toBe(1);
    expect(tools[0].name).toBe('test_tool');
  });

  it('returns prompt sections', () => {
    const skill = new TestSkill();
    expect(skill.getPromptSections()).toHaveLength(1);
  });

  it('returns hints', () => {
    const skill = new TestSkill();
    expect(skill.getHints()).toEqual(['test hint']);
  });

  it('returns global data', () => {
    const skill = new TestSkill();
    expect(skill.getGlobalData()).toEqual({ test_key: 'test_value' });
  });

  it('validates missing env vars', () => {
    const saved = process.env['TEST_API_KEY'];
    delete process.env['TEST_API_KEY'];
    try {
      const skill = new TestSkill();
      const missing = skill.validateEnvVars();
      expect(missing).toContain('TEST_API_KEY');
    } finally {
      if (saved) process.env['TEST_API_KEY'] = saved;
    }
  });

  it('validates present env vars', () => {
    process.env['TEST_API_KEY'] = 'test-key';
    try {
      const skill = new TestSkill();
      expect(skill.validateEnvVars()).toHaveLength(0);
    } finally {
      delete process.env['TEST_API_KEY'];
    }
  });

  it('initialized state', () => {
    const skill = new TestSkill();
    expect(skill.isInitialized()).toBe(false);
    skill.markInitialized();
    expect(skill.isInitialized()).toBe(true);
  });

  it('getConfig with default', () => {
    const skill = new TestSkill({ apiUrl: 'https://example.com' });
    expect(skill.getConfig('apiUrl')).toBe('https://example.com');
    expect(skill.getConfig('missing', 'default')).toBe('default');
  });

  it('setup and cleanup are no-op by default', async () => {
    const skill = new TestSkill();
    await expect(skill.setup()).resolves.toBeUndefined();
    await expect(skill.cleanup()).resolves.toBeUndefined();
  });
});
