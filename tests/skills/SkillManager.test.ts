import { describe, it, expect, beforeEach } from 'vitest';
import { SkillManager } from '../../src/skills/SkillManager.js';
import { SkillBase, type SkillManifest, type SkillToolDefinition } from '../../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../../src/SwaigFunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

class MockSkill extends SkillBase {
  setupCalled = false;
  cleanupCalled = false;

  constructor(name = 'mock_skill', config?: Record<string, unknown>) {
    super(name, config);
  }

  getManifest(): SkillManifest {
    return { name: this.skillName, description: 'Mock', version: '1.0.0' };
  }

  getTools(): SkillToolDefinition[] {
    return [{
      name: `${this.skillName}_tool`,
      description: 'Mock tool',
      handler: () => new SwaigFunctionResult('mock result'),
    }];
  }

  getPromptSections() {
    return [{ title: `${this.skillName} Section`, body: 'Mock body' }];
  }

  getHints() {
    return [`${this.skillName} hint`];
  }

  getGlobalData() {
    return { [`${this.skillName}_data`]: true };
  }

  async setup() {
    this.setupCalled = true;
  }

  async cleanup() {
    this.cleanupCalled = true;
  }
}

/** Multi-instance mock skill that uses instanceId to allow duplicates. */
class MultiMockSkill extends MockSkill {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  override getInstanceKey(): string {
    return this.instanceId; // Each instance gets a unique key
  }
}

describe('SkillManager', () => {
  let manager: SkillManager;

  beforeEach(() => {
    suppressAllLogs(true);
    manager = new SkillManager();
  });

  it('adds a skill', async () => {
    const skill = new MockSkill();
    await manager.addSkill(skill);
    expect(manager.size).toBe(1);
    expect(skill.setupCalled).toBe(true);
    expect(skill.isInitialized()).toBe(true);
  });

  it('rejects duplicate skill instances', async () => {
    const skill = new MockSkill();
    await manager.addSkill(skill);
    await expect(manager.addSkill(skill)).rejects.toThrow('already loaded');
  });

  it('removes a skill by instance ID', async () => {
    const skill = new MockSkill();
    await manager.addSkill(skill);
    const removed = await manager.removeSkill(skill.instanceId);
    expect(removed).toBe(true);
    expect(skill.cleanupCalled).toBe(true);
    expect(manager.size).toBe(0);
  });

  it('returns false when removing non-existent skill', async () => {
    expect(await manager.removeSkill('nope')).toBe(false);
  });

  it('removes skills by name', async () => {
    const s1 = new MultiMockSkill('weather');
    const s2 = new MultiMockSkill('weather');
    const s3 = new MockSkill('math');
    await manager.addSkill(s1);
    await manager.addSkill(s2);
    await manager.addSkill(s3);
    const count = await manager.removeSkillByName('weather');
    expect(count).toBe(2);
    expect(manager.size).toBe(1);
  });

  it('hasSkill checks by name', async () => {
    const skill = new MockSkill('datetime');
    await manager.addSkill(skill);
    expect(manager.hasSkill('datetime')).toBe(true);
    expect(manager.hasSkill('missing')).toBe(false);
  });

  it('getSkill by instance ID', async () => {
    const skill = new MockSkill();
    await manager.addSkill(skill);
    expect(manager.getSkill(skill.instanceId)).toBe(skill);
    expect(manager.getSkill('nope')).toBeUndefined();
  });

  it('listSkills returns all loaded skills', async () => {
    await manager.addSkill(new MockSkill('a'));
    await manager.addSkill(new MockSkill('b'));
    const list = manager.listSkills();
    expect(list).toHaveLength(2);
    expect(list.map(s => s.name)).toContain('a');
    expect(list.map(s => s.name)).toContain('b');
  });

  it('getAllTools aggregates tools from all skills', async () => {
    await manager.addSkill(new MockSkill('a'));
    await manager.addSkill(new MockSkill('b'));
    const tools = manager.getAllTools();
    expect(tools).toHaveLength(2);
  });

  it('getAllPromptSections aggregates sections', async () => {
    await manager.addSkill(new MockSkill('a'));
    await manager.addSkill(new MockSkill('b'));
    expect(manager.getAllPromptSections()).toHaveLength(2);
  });

  it('getAllHints aggregates hints', async () => {
    await manager.addSkill(new MockSkill('a'));
    await manager.addSkill(new MockSkill('b'));
    expect(manager.getAllHints()).toHaveLength(2);
  });

  it('getMergedGlobalData merges all skill data', async () => {
    await manager.addSkill(new MockSkill('a'));
    await manager.addSkill(new MockSkill('b'));
    const data = manager.getMergedGlobalData();
    expect(data['a_data']).toBe(true);
    expect(data['b_data']).toBe(true);
  });

  it('clear removes all skills and calls cleanup', async () => {
    const s1 = new MockSkill('a');
    const s2 = new MockSkill('b');
    await manager.addSkill(s1);
    await manager.addSkill(s2);
    await manager.clear();
    expect(manager.size).toBe(0);
    expect(s1.cleanupCalled).toBe(true);
    expect(s2.cleanupCalled).toBe(true);
  });

  it('supports multi-instance of same skill', async () => {
    const s1 = new MultiMockSkill('weather');
    const s2 = new MultiMockSkill('weather');
    await manager.addSkill(s1);
    await manager.addSkill(s2);
    expect(manager.size).toBe(2);
    expect(manager.hasSkill('weather')).toBe(true);
  });
});
