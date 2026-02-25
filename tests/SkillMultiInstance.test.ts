import { describe, it, expect } from 'vitest';
import { SkillBase, type SkillManifest, type SkillToolDefinition, type SkillConfig, type ParameterSchemaEntry } from '../src/skills/SkillBase.js';
import { SkillManager } from '../src/skills/SkillManager.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';

/** Single-instance test skill. */
class SingleInstanceSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('single_skill', config);
  }
  getManifest(): SkillManifest {
    return { name: 'single_skill', description: 'Single instance', version: '1.0.0' };
  }
  getTools(): SkillToolDefinition[] {
    return [{ name: 'single_tool', description: 'tool', handler: () => new SwaigFunctionResult('ok') }];
  }
}

/** Multi-instance test skill. */
class MultiInstanceSkill extends SkillBase {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: { type: 'string', description: 'Custom tool name for this instance.' },
    };
  }

  constructor(config?: SkillConfig) {
    super('multi_skill', config);
  }

  override getInstanceKey(): string {
    const toolName = this.getConfig<string | undefined>('tool_name', undefined);
    return toolName ? `${this.skillName}_${toolName}` : this.skillName;
  }

  getManifest(): SkillManifest {
    return { name: 'multi_skill', description: 'Multi instance', version: '1.0.0' };
  }
  getTools(): SkillToolDefinition[] {
    const name = this.getConfig<string>('tool_name', 'multi_tool');
    return [{ name, description: 'tool', handler: () => new SwaigFunctionResult('ok') }];
  }
}

describe('Skill Multi-Instance', () => {
  it('single-instance skill loaded twice throws', async () => {
    const manager = new SkillManager();
    await manager.addSkill(new SingleInstanceSkill());
    await expect(manager.addSkill(new SingleInstanceSkill())).rejects.toThrow(
      /already loaded.*does not support multiple/,
    );
  });

  it('multi-instance skill loaded twice with different tool_name succeeds', async () => {
    const manager = new SkillManager();
    await manager.addSkill(new MultiInstanceSkill({ tool_name: 'search_a' }));
    await manager.addSkill(new MultiInstanceSkill({ tool_name: 'search_b' }));
    expect(manager.size).toBe(2);
  });

  it('multi-instance skill loaded twice with same tool_name is skipped', async () => {
    const manager = new SkillManager();
    await manager.addSkill(new MultiInstanceSkill({ tool_name: 'search_a' }));
    // Should warn and skip, not throw
    await manager.addSkill(new MultiInstanceSkill({ tool_name: 'search_a' }));
    expect(manager.size).toBe(1);
  });

  it('getInstanceKey returns skillName_toolName for multi-instance', () => {
    const skill = new MultiInstanceSkill({ tool_name: 'my_search' });
    expect(skill.getInstanceKey()).toBe('multi_skill_my_search');
  });

  it('getInstanceKey returns skillName when no tool_name', () => {
    const skill = new MultiInstanceSkill();
    expect(skill.getInstanceKey()).toBe('multi_skill');
  });

  it('getLoadedSkillEntries returns re-playable entries', async () => {
    const manager = new SkillManager();
    await manager.addSkill(new MultiInstanceSkill({ tool_name: 'a' }));
    await manager.addSkill(new MultiInstanceSkill({ tool_name: 'b' }));

    const entries = manager.getLoadedSkillEntries();
    expect(entries.length).toBe(2);
    expect(entries[0].skillName).toBe('multi_skill');
    expect(entries[0].SkillClass).toBe(MultiInstanceSkill);
    expect(entries[0].config).toHaveProperty('tool_name');

    // Entries should be usable to re-create skills
    const recreated = new entries[0].SkillClass(entries[0].config);
    expect(recreated).toBeInstanceOf(MultiInstanceSkill);
  });

  it('SUPPORTS_MULTIPLE_INSTANCES is false on base', () => {
    expect(SkillBase.SUPPORTS_MULTIPLE_INSTANCES).toBe(false);
  });

  it('SUPPORTS_MULTIPLE_INSTANCES is true on multi-instance class', () => {
    expect(MultiInstanceSkill.SUPPORTS_MULTIPLE_INSTANCES).toBe(true);
  });
});
