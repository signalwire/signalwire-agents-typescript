/**
 * SkillManager - Manages skill lifecycle for an agent.
 *
 * Handles loading, unloading, validation, and injection of
 * skill tools, hints, global data, and prompt sections.
 */

import { SkillBase } from './SkillBase.js';
import { getLogger } from '../Logger.js';

const log = getLogger('SkillManager');

/**
 * Manages the lifecycle of skills attached to an agent.
 *
 * Handles loading, unloading, validation, and aggregation of skill tools,
 * hints, global data, and prompt sections.
 */
export class SkillManager {
  private skills: Map<string, SkillBase> = new Map();

  /**
   * Add a skill to the manager, validating env vars and calling setup().
   * @param skill - The skill instance to add.
   */
  async addSkill(skill: SkillBase): Promise<void> {
    const name = skill.skillName;

    if (this.skills.has(skill.instanceId)) {
      throw new Error(`Skill instance '${skill.instanceId}' is already loaded`);
    }

    // Validate required env vars
    const missingEnvVars = skill.validateEnvVars();
    if (missingEnvVars.length) {
      log.warn(`Skill '${name}' missing env vars: ${missingEnvVars.join(', ')}`);
    }

    // Setup
    await skill.setup();
    skill.markInitialized();

    this.skills.set(skill.instanceId, skill);
    log.debug(`Added skill '${name}' (${skill.instanceId})`);
  }

  /**
   * Remove a skill by its instance ID, calling cleanup() before removal.
   * @param instanceId - The unique instance ID of the skill to remove.
   * @returns True if the skill was found and removed, false otherwise.
   */
  async removeSkill(instanceId: string): Promise<boolean> {
    const skill = this.skills.get(instanceId);
    if (!skill) return false;

    await skill.cleanup();
    this.skills.delete(instanceId);
    log.debug(`Removed skill '${skill.skillName}' (${instanceId})`);
    return true;
  }

  /**
   * Remove all skill instances matching a given skill name.
   * @param skillName - The skill name to match against.
   * @returns The number of skill instances removed.
   */
  async removeSkillByName(skillName: string): Promise<number> {
    let count = 0;
    for (const [id, skill] of this.skills) {
      if (skill.skillName === skillName) {
        await skill.cleanup();
        this.skills.delete(id);
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
   * Get a skill by its unique instance ID.
   * @param instanceId - The instance ID to look up.
   * @returns The skill instance, or undefined if not found.
   */
  getSkill(instanceId: string): SkillBase | undefined {
    return this.skills.get(instanceId);
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
   * Remove all skills and clean up.
   */
  async clear(): Promise<void> {
    for (const skill of this.skills.values()) {
      await skill.cleanup();
    }
    this.skills.clear();
  }
}
