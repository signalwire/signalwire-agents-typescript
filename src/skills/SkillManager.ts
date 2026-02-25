/**
 * SkillManager - Manages skill lifecycle for an agent.
 *
 * Handles loading, unloading, validation, and injection of
 * skill tools, hints, global data, and prompt sections.
 */

import { SkillBase, type SkillConfig } from './SkillBase.js';
import { getLogger } from '../Logger.js';

const log = getLogger('SkillManager');

/** Stored metadata for a loaded skill, enabling ephemeral copy re-instantiation. */
interface SkillMetaEntry {
  /** The skill class constructor. */
  SkillClass: typeof SkillBase;
  /** The config originally passed to the skill. */
  config: SkillConfig;
  /** The skill name. */
  skillName: string;
}

/**
 * Manages the lifecycle of skills attached to an agent.
 *
 * Handles loading, unloading, validation, and aggregation of skill tools,
 * hints, global data, and prompt sections.
 */
export class SkillManager {
  private skills: Map<string, SkillBase> = new Map();
  private skillMeta: Map<string, SkillMetaEntry> = new Map();

  /**
   * Add a skill to the manager, validating env vars and calling setup().
   * Uses the skill's instance key for deduplication.
   * @param skill - The skill instance to add.
   */
  async addSkill(skill: SkillBase): Promise<void> {
    const name = skill.skillName;
    const instanceKey = skill.getInstanceKey();
    const SkillClass = skill.constructor as typeof SkillBase;

    // Duplicate detection using instance key
    if (this.skills.has(instanceKey)) {
      if (!SkillClass.SUPPORTS_MULTIPLE_INSTANCES) {
        throw new Error(`Skill '${name}' is already loaded and does not support multiple instances`);
      }
      log.warn(`Skill '${name}' with key '${instanceKey}' already loaded, skipping duplicate`);
      return;
    }

    // Validate required env vars
    const missingEnvVars = skill.validateEnvVars();
    if (missingEnvVars.length) {
      log.warn(`Skill '${name}' missing env vars: ${missingEnvVars.join(', ')}`);
    }

    // Log parameter schema info (non-fatal)
    const schema = SkillClass.getParameterSchema();
    if (schema && Object.keys(schema).length > 0) {
      log.debug(`Skill '${name}' has ${Object.keys(schema).length} config params`);
    }

    // Setup
    await skill.setup();
    skill.markInitialized();

    this.skills.set(instanceKey, skill);
    this.skillMeta.set(instanceKey, {
      SkillClass,
      config: { ...skill['config'] },
      skillName: name,
    });
    log.debug(`Added skill '${name}' (key: ${instanceKey})`);
  }

  /**
   * Remove a skill by its instance key or instance ID, calling cleanup() before removal.
   * @param keyOrId - The instance key or instance ID of the skill to remove.
   * @returns True if the skill was found and removed, false otherwise.
   */
  async removeSkill(keyOrId: string): Promise<boolean> {
    // Try by instance key first
    let skill = this.skills.get(keyOrId);
    let key = keyOrId;

    // Fallback: search by instanceId for backward compatibility
    if (!skill) {
      for (const [k, s] of this.skills) {
        if (s.instanceId === keyOrId) {
          skill = s;
          key = k;
          break;
        }
      }
    }

    if (!skill) return false;

    await skill.cleanup();
    this.skills.delete(key);
    this.skillMeta.delete(key);
    log.debug(`Removed skill '${skill.skillName}' (${key})`);
    return true;
  }

  /**
   * Remove all skill instances matching a given skill name.
   * @param skillName - The skill name to match against.
   * @returns The number of skill instances removed.
   */
  async removeSkillByName(skillName: string): Promise<number> {
    let count = 0;
    for (const [key, skill] of this.skills) {
      if (skill.skillName === skillName) {
        await skill.cleanup();
        this.skills.delete(key);
        this.skillMeta.delete(key);
        count++;
      }
    }
    return count;
  }

  /**
   * Check if any skill instance with the given name is currently loaded.
   * @param skillName - The skill name to check for.
   * @returns True if at least one instance with this name is loaded.
   */
  hasSkill(skillName: string): boolean {
    for (const skill of this.skills.values()) {
      if (skill.skillName === skillName) return true;
    }
    return false;
  }

  /**
   * Get a skill by its instance key or instance ID.
   * @param keyOrId - The instance key or instance ID to look up.
   * @returns The skill instance, or undefined if not found.
   */
  getSkill(keyOrId: string): SkillBase | undefined {
    const skill = this.skills.get(keyOrId);
    if (skill) return skill;
    // Fallback: search by instanceId
    for (const s of this.skills.values()) {
      if (s.instanceId === keyOrId) return s;
    }
    return undefined;
  }

  /**
   * List all loaded skill instances with their name, ID, and initialization state.
   * @returns Array of skill summary objects.
   */
  listSkills(): { name: string; instanceId: string; initialized: boolean }[] {
    return Array.from(this.skills.values()).map(s => ({
      name: s.skillName,
      instanceId: s.instanceId,
      initialized: s.isInitialized(),
    }));
  }

  /**
   * Aggregate tool definitions from all loaded skills.
   * @returns Combined array of all skill tool definitions.
   */
  getAllTools(): ReturnType<SkillBase['getTools']> {
    const tools: ReturnType<SkillBase['getTools']> = [];
    for (const skill of this.skills.values()) {
      tools.push(...skill.getTools());
    }
    return tools;
  }

  /**
   * Aggregate prompt sections from all loaded skills.
   * @returns Combined array of all skill prompt sections.
   */
  getAllPromptSections(): ReturnType<SkillBase['getPromptSections']> {
    const sections: ReturnType<SkillBase['getPromptSections']> = [];
    for (const skill of this.skills.values()) {
      sections.push(...skill.getPromptSections());
    }
    return sections;
  }

  /**
   * Aggregate speech recognition hints from all loaded skills.
   * @returns Combined array of all skill hint strings.
   */
  getAllHints(): string[] {
    const hints: string[] = [];
    for (const skill of this.skills.values()) {
      hints.push(...skill.getHints());
    }
    return hints;
  }

  /**
   * Merge global data from all loaded skills into a single object.
   * @returns Combined global data (later skills override earlier ones on key conflicts).
   */
  getMergedGlobalData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const skill of this.skills.values()) {
      Object.assign(data, skill.getGlobalData());
    }
    return data;
  }

  /**
   * Get the number of currently loaded skill instances.
   * @returns The count of loaded skills.
   */
  get size(): number {
    return this.skills.size;
  }

  /**
   * Get metadata for all loaded skills, enabling ephemeral copy re-instantiation.
   * @returns Array of entries containing skill name, class constructor, and config.
   */
  getLoadedSkillEntries(): Array<{ skillName: string; SkillClass: typeof SkillBase; config: SkillConfig }> {
    return Array.from(this.skillMeta.values()).map(entry => ({
      skillName: entry.skillName,
      SkillClass: entry.SkillClass,
      config: { ...entry.config },
    }));
  }

  /**
   * Remove all skills and clean up.
   */
  async clear(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.cleanup();
    }
    this.skills.clear();
    this.skillMeta.clear();
  }
}
