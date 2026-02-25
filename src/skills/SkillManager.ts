/**
 * SkillManager - Manages skill lifecycle for an agent.
 *
 * Handles loading, unloading, validation, and injection of
 * skill tools, hints, global data, and prompt sections.
 */

import { SkillBase } from './SkillBase.js';
import { getLogger } from '../Logger.js';

const log = getLogger('SkillManager');

export class SkillManager {
  private skills: Map<string, SkillBase> = new Map();

  /**
   * Add a skill to the manager. Validates env vars and calls setup().
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
   * Remove a skill by its instance ID.
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
   * Remove all skills with a given skill name.
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
   * Check if a skill (by name) is loaded.
   */
  hasSkill(skillName: string): boolean {
    for (const skill of this.skills.values()) {
      if (skill.skillName === skillName) return true;
    }
    return false;
  }

  /**
   * Get a skill by instance ID.
   */
  getSkill(instanceId: string): SkillBase | undefined {
    return this.skills.get(instanceId);
  }

  /**
   * List all loaded skills.
   */
  listSkills(): { name: string; instanceId: string; initialized: boolean }[] {
    return Array.from(this.skills.values()).map(s => ({
      name: s.skillName,
      instanceId: s.instanceId,
      initialized: s.isInitialized(),
    }));
  }

  /**
   * Get all tool definitions from all loaded skills.
   */
  getAllTools(): ReturnType<SkillBase['getTools']> {
    const tools: ReturnType<SkillBase['getTools']> = [];
    for (const skill of this.skills.values()) {
      tools.push(...skill.getTools());
    }
    return tools;
  }

  /**
   * Get all prompt sections from all loaded skills.
   */
  getAllPromptSections(): ReturnType<SkillBase['getPromptSections']> {
    const sections: ReturnType<SkillBase['getPromptSections']> = [];
    for (const skill of this.skills.values()) {
      sections.push(...skill.getPromptSections());
    }
    return sections;
  }

  /**
   * Get all hints from all loaded skills.
   */
  getAllHints(): string[] {
    const hints: string[] = [];
    for (const skill of this.skills.values()) {
      hints.push(...skill.getHints());
    }
    return hints;
  }

  /**
   * Get merged global data from all loaded skills.
   */
  getMergedGlobalData(): Record<string, unknown> {
    const data: Record<string, unknown> = {};
    for (const skill of this.skills.values()) {
      Object.assign(data, skill.getGlobalData());
    }
    return data;
  }

  /**
   * Get the count of loaded skills.
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
