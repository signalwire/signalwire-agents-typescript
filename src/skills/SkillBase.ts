/**
 * SkillBase - Abstract base class for agent skills.
 *
 * Skills are modular capabilities that can be added to an agent.
 * They define tools, prompt sections, hints, and global data.
 */

import { randomBytes } from 'node:crypto';
import type { SwaigHandler } from '../SwaigFunction.js';

export interface SkillConfig {
  [key: string]: unknown;
}

export interface SkillToolDefinition {
  name: string;
  description: string;
  parameters?: Record<string, unknown>;
  handler: SwaigHandler;
  secure?: boolean;
  fillers?: Record<string, string[]>;
  required?: string[];
}

export interface SkillPromptSection {
  title: string;
  body?: string;
  bullets?: string[];
  numbered?: boolean;
}

export interface SkillManifest {
  name: string;
  description: string;
  version: string;
  author?: string;
  tags?: string[];
  requiredEnvVars?: string[];
  requiredPackages?: string[];
  configSchema?: Record<string, unknown>;
}

export abstract class SkillBase {
  readonly skillName: string;
  readonly instanceId: string;
  protected config: SkillConfig;
  private _initialized = false;

  constructor(skillName: string, config?: SkillConfig) {
    this.skillName = skillName;
    this.config = config ?? {};
    this.instanceId = `${skillName}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  }

  /**
   * Get the skill manifest (metadata).
   */
  abstract getManifest(): SkillManifest;

  /**
   * Setup the skill. Called when the skill is added to an agent.
   * Override to perform initialization (API connections, config validation, etc.)
   */
  async setup(): Promise<void> {
    // Default no-op
  }

  /**
   * Register tools with the agent. Override to define SWAIG tools.
   */
  abstract getTools(): SkillToolDefinition[];

  /**
   * Get prompt sections to inject into the agent's prompt.
   */
  getPromptSections(): SkillPromptSection[] {
    return [];
  }

  /**
   * Get hints to add to the agent.
   */
  getHints(): string[] {
    return [];
  }

  /**
   * Get global data to merge into the agent's global data.
   */
  getGlobalData(): Record<string, unknown> {
    return {};
  }

  /**
   * Cleanup resources. Called when the skill is removed from an agent.
   */
  async cleanup(): Promise<void> {
    // Default no-op
  }

  /**
   * Validate that required environment variables are set.
   */
  validateEnvVars(): string[] {
    const manifest = this.getManifest();
    const missing: string[] = [];
    if (manifest.requiredEnvVars) {
      for (const envVar of manifest.requiredEnvVars) {
        if (!process.env[envVar]) {
          missing.push(envVar);
        }
      }
    }
    return missing;
  }

  /**
   * Check if the skill has been initialized.
   */
  isInitialized(): boolean {
    return this._initialized;
  }

  /**
   * Mark the skill as initialized (called by SkillManager).
   */
  markInitialized(): void {
    this._initialized = true;
  }

  /**
   * Get a config value with optional default.
   */
  getConfig<T = unknown>(key: string, defaultValue?: T): T {
    return (this.config[key] !== undefined ? this.config[key] : defaultValue) as T;
  }
}
