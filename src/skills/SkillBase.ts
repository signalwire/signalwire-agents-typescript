/**
 * SkillBase - Abstract base class for agent skills.
 *
 * Skills are modular capabilities that can be added to an agent.
 * They define tools, prompt sections, hints, and global data.
 */

import { randomBytes } from 'node:crypto';
import type { SwaigHandler } from '../SwaigFunction.js';

/** Configuration key-value pairs passed to a skill at construction time. */
export interface SkillConfig {
  [key: string]: unknown;
}

/** Definition of a SWAIG tool provided by a skill. */
export interface SkillToolDefinition {
  /** Unique tool name used in SWAIG function registration. */
  name: string;
  /** Human-readable description of what the tool does, shown to the AI. */
  description: string;
  /** Parameter schema for the tool, keyed by parameter name. */
  parameters?: Record<string, unknown>;
  /** Handler function invoked when the tool is called. */
  handler: SwaigHandler;
  /** Whether the tool requires secure (authenticated) invocation. */
  secure?: boolean;
  /** Filler phrases spoken while the tool executes, keyed by language. */
  fillers?: Record<string, string[]>;
  /** List of parameter names that are required. */
  required?: string[];
}

/** A section of prompt content injected into the agent's system prompt by a skill. */
export interface SkillPromptSection {
  /** Section heading displayed in the prompt. */
  title: string;
  /** Optional body text for the section. */
  body?: string;
  /** Optional bullet points appended after the body. */
  bullets?: string[];
  /** If true, render bullets as a numbered list instead of unordered. */
  numbered?: boolean;
}

/** Metadata describing a skill's identity, requirements, and configuration schema. */
export interface SkillManifest {
  /** Unique skill name used for registration and lookup. */
  name: string;
  /** Human-readable description of the skill's purpose. */
  description: string;
  /** Semantic version string (e.g., "1.0.0"). */
  version: string;
  /** Author or organization that created the skill. */
  author?: string;
  /** Tags for categorization and discovery. */
  tags?: string[];
  /** Environment variables that must be set for the skill to function. */
  requiredEnvVars?: string[];
  /** NPM packages or external dependencies required by the skill. */
  requiredPackages?: string[];
  /** JSON-schema-like description of the skill's configuration options. */
  configSchema?: Record<string, unknown>;
}

/**
 * Abstract base class for agent skills.
 *
 * Skills are modular capabilities that can be added to an agent.
 * They define tools, prompt sections, hints, and global data.
 */
export abstract class SkillBase {
  /** The registered name of this skill type. */
  readonly skillName: string;
  /** Unique identifier for this skill instance (includes timestamp and random bytes). */
  readonly instanceId: string;
  /** Configuration options provided at construction time. */
  protected config: SkillConfig;
  private _initialized = false;

  /**
   * Create a new skill instance.
   * @param skillName - The registered name for this skill type.
   * @param config - Optional configuration key-value pairs.
   */
  constructor(skillName: string, config?: SkillConfig) {
    this.skillName = skillName;
    this.config = config ?? {};
    this.instanceId = `${skillName}-${Date.now().toString(36)}-${randomBytes(4).toString('hex')}`;
  }

  /**
   * Get the skill manifest containing metadata, requirements, and config schema.
   * @returns The skill's manifest object.
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
   * Return the SWAIG tool definitions this skill provides.
   * @returns Array of tool definitions to register with the agent.
   */
  abstract getTools(): SkillToolDefinition[];

  /**
   * Get prompt sections to inject into the agent's system prompt.
   * @returns Array of prompt sections with titles, bodies, and bullets.
   */
  getPromptSections(): SkillPromptSection[] {
    return [];
  }

  /**
   * Get speech recognition hints relevant to this skill.
   * @returns Array of hint strings to improve speech recognition accuracy.
   */
  getHints(): string[] {
    return [];
  }

  /**
   * Get global data to merge into the agent's global data store.
   * @returns Key-value pairs to be merged into the agent's global data.
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
   * Validate that all required environment variables declared in the manifest are set.
   * @returns Array of missing environment variable names (empty if all are present).
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
   * Check if the skill has been initialized by the SkillManager.
   * @returns True if setup() has completed and the skill is marked initialized.
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
   * Get a configuration value by key, falling back to a default if not set.
   * @param key - The configuration key to look up.
   * @param defaultValue - Value to return if the key is not present.
   * @returns The configuration value cast to type T, or the default value.
   */
  getConfig<T = unknown>(key: string, defaultValue?: T): T {
    return (this.config[key] !== undefined ? this.config[key] : defaultValue) as T;
  }
}
