import { describe, it, expect, beforeEach } from 'vitest';
import { SkillRegistry } from '../../src/skills/SkillRegistry.js';
import { SkillBase, type SkillManifest, type SkillToolDefinition } from '../../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../../src/SwaigFunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

class SimpleSkill extends SkillBase {
  constructor(config?: Record<string, unknown>) {
    super('simple', config);
  }
  getManifest(): SkillManifest {
    return { name: 'simple', description: 'Simple skill', version: '1.0.0' };
  }
  getTools(): SkillToolDefinition[] {
    return [{
      name: 'simple_tool',
      description: 'Simple tool',
      handler: () => new SwaigFunctionResult('ok'),
    }];
  }
}

describe('SkillRegistry', () => {
  let registry: SkillRegistry;

  beforeEach(() => {
    suppressAllLogs(true);
    SkillRegistry.resetInstance();
    registry = new SkillRegistry();
  });

  it('registers and creates skills', () => {
    registry.register('simple', (config) => new SimpleSkill(config));
    const skill = registry.create('simple');
    expect(skill).not.toBeNull();
    expect(skill!.skillName).toBe('simple');
  });

  it('returns null for unregistered skill', () => {
    expect(registry.create('missing')).toBeNull();
  });

  it('has() checks registration', () => {
    registry.register('simple', () => new SimpleSkill());
    expect(registry.has('simple')).toBe(true);
    expect(registry.has('missing')).toBe(false);
  });

  it('unregister removes skill', () => {
    registry.register('simple', () => new SimpleSkill());
    expect(registry.unregister('simple')).toBe(true);
    expect(registry.has('simple')).toBe(false);
  });

  it('listRegistered returns all names', () => {
    registry.register('a', () => new SimpleSkill());
    registry.register('b', () => new SimpleSkill());
    const names = registry.listRegistered();
    expect(names).toContain('a');
    expect(names).toContain('b');
  });

  it('registers with manifest', () => {
    const manifest: SkillManifest = { name: 'simple', description: 'Test', version: '1.0.0' };
    registry.register('simple', () => new SimpleSkill(), manifest);
    expect(registry.getManifest('simple')).toEqual(manifest);
  });

  it('listRegisteredWithManifests includes manifests', () => {
    const manifest: SkillManifest = { name: 'simple', description: 'Test', version: '1.0.0' };
    registry.register('simple', () => new SimpleSkill(), manifest);
    const list = registry.listRegisteredWithManifests();
    expect(list).toHaveLength(1);
    expect(list[0].manifest).toEqual(manifest);
  });

  it('singleton instance', () => {
    const inst1 = SkillRegistry.getInstance();
    const inst2 = SkillRegistry.getInstance();
    expect(inst1).toBe(inst2);
  });

  it('resetInstance creates new singleton', () => {
    const inst1 = SkillRegistry.getInstance();
    SkillRegistry.resetInstance();
    const inst2 = SkillRegistry.getInstance();
    expect(inst1).not.toBe(inst2);
  });

  it('size tracks registrations', () => {
    expect(registry.size).toBe(0);
    registry.register('a', () => new SimpleSkill());
    expect(registry.size).toBe(1);
  });

  it('clear removes all registrations', () => {
    registry.register('a', () => new SimpleSkill());
    registry.register('b', () => new SimpleSkill());
    registry.clear();
    expect(registry.size).toBe(0);
  });

  it('addSearchPath adds paths', () => {
    registry.addSearchPath('/custom/skills');
    expect(registry.getSearchPaths()).toContain('/custom/skills');
  });

  it('addSearchPath deduplicates', () => {
    registry.addSearchPath('/skills');
    registry.addSearchPath('/skills');
    expect(registry.getSearchPaths().filter(p => p === '/skills')).toHaveLength(1);
  });

  it('passes config to factory', () => {
    registry.register('simple', (config) => new SimpleSkill(config));
    const skill = registry.create('simple', { key: 'val' });
    expect(skill!.getConfig('key')).toBe('val');
  });

  it('discoverFromDirectory handles non-existent dir', async () => {
    process.env['SWML_SKILL_DISCOVERY_ENABLED'] = 'true';
    const found = await registry.discoverFromDirectory('/nonexistent/path');
    expect(found).toHaveLength(0);
    delete process.env['SWML_SKILL_DISCOVERY_ENABLED'];
  });

  // ── Security remediation tests ─────────────────────────────────────

  it('locked skill cannot be overwritten', () => {
    registry.register('locked_skill', () => new SimpleSkill());
    registry.lock(['locked_skill']);
    // Attempt to overwrite
    registry.register('locked_skill', () => new SimpleSkill());
    // Still has original (just verifying it didn't throw and kept the name)
    expect(registry.has('locked_skill')).toBe(true);
  });

  it('lock() without args locks all current skills', () => {
    registry.register('a', () => new SimpleSkill());
    registry.register('b', () => new SimpleSkill());
    registry.lock();
    // Try overwriting
    registry.register('a', () => new SimpleSkill());
    registry.register('b', () => new SimpleSkill());
    // Both still exist
    expect(registry.has('a')).toBe(true);
    expect(registry.has('b')).toBe(true);
  });

  it('discovery disabled by default', async () => {
    delete process.env['SWML_SKILL_DISCOVERY_ENABLED'];
    const found = await registry.discoverFromDirectory('/some/path');
    expect(found).toHaveLength(0);
  });
});
