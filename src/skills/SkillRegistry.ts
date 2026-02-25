/**
 * SkillRegistry - Global singleton registry for discovering and loading skills.
 *
 * Skills can be registered programmatically or discovered from directories.
 * Supports SIGNALWIRE_SKILL_PATHS env var for custom skill directories.
 */

import { SkillBase, type SkillConfig, type SkillManifest, type ParameterSchemaEntry } from './SkillBase.js';
import { getLogger } from '../Logger.js';

const log = getLogger('SkillRegistry');

/** Factory function that creates a SkillBase instance from optional configuration. */
export type SkillFactory = (config?: SkillConfig) => SkillBase;

/** Internal registry entry associating a skill name with its factory and optional manifest. */
interface RegistryEntry {
  /** Registered skill name. */
  name: string;
  /** Factory function to create instances of this skill. */
  factory: SkillFactory;
  /** Optional pre-loaded manifest for the skill. */
  manifest?: SkillManifest;
}

/** Combined schema information for a registered skill, including manifest and parameter schema. */
export interface SkillSchemaInfo {
  /** The skill's registered name. */
  name: string;
  /** Human-readable description of the skill. */
  description: string;
  /** Semantic version string. */
  version: string;
  /** Whether this skill supports multiple simultaneous instances. */
  supportsMultipleInstances: boolean;
  /** Environment variables required by the skill. */
  requiredEnvVars: string[];
  /** Full parameter schema with types, defaults, and constraints. */
  parameters: Record<string, ParameterSchemaEntry>;
  /** Optional source category for grouping (e.g., "builtin"). */
  source?: string;
}

let _instance: SkillRegistry | null = null;

/**
 * Global singleton registry for discovering and instantiating skills.
 *
 * Skills can be registered programmatically or auto-discovered from directories.
 * Supports the SIGNALWIRE_SKILL_PATHS environment variable for custom skill directories.
 */
export class SkillRegistry {
  private registry: Map<string, RegistryEntry> = new Map();
  private lockedNames: Set<string> = new Set();
  private searchPaths: string[];

  constructor() {
    const envPaths = process.env['SIGNALWIRE_SKILL_PATHS'];
    this.searchPaths = envPaths ? envPaths.split(':').filter(Boolean) : [];
  }

  /**
   * Get the global singleton instance, creating it on first access.
   * @returns The shared SkillRegistry instance.
   */
  static getInstance(): SkillRegistry {
    if (!_instance) {
      _instance = new SkillRegistry();
    }
    return _instance;
  }

  /**
   * Reset the global singleton (for testing).
   */
  static resetInstance(): void {
    _instance = null;
  }

  /**
   * Register a skill factory by name, optionally with a pre-loaded manifest.
   * @param name - The unique skill name.
   * @param factory - Factory function to create skill instances.
   * @param manifest - Optional manifest metadata for the skill.
   */
  register(name: string, factory: SkillFactory, manifest?: SkillManifest): void {
    if (this.lockedNames.has(name)) {
      log.warn(`Cannot overwrite locked skill: ${name}`);
      return;
    }
    if (this.registry.has(name)) {
      log.warn(`Overwriting skill registration: ${name}`);
    }
    this.registry.set(name, { name, factory, manifest });
    log.debug(`Registered skill: ${name}`);
  }

  /**
   * Lock one or more skill names to prevent overwriting.
   * If called with no arguments, locks all currently registered skills.
   * @param names - Skill names to lock; if omitted, all current names are locked.
   */
  lock(names?: string[]): void {
    const toLock = names ?? Array.from(this.registry.keys());
    for (const name of toLock) {
      this.lockedNames.add(name);
    }
  }

  /**
   * Unregister a skill by name, removing it from the registry.
   * @param name - The skill name to unregister.
   * @returns True if the skill was found and removed.
   */
  unregister(name: string): boolean {
    return this.registry.delete(name);
  }

  /**
   * Create a new skill instance by looking up its factory in the registry.
   * @param name - The registered skill name.
   * @param config - Optional configuration to pass to the factory.
   * @returns A new skill instance, or null if the name is not registered.
   */
  create(name: string, config?: SkillConfig): SkillBase | null {
    const entry = this.registry.get(name);
    if (!entry) {
      log.warn(`Skill not found in registry: ${name}`);
      return null;
    }
    return entry.factory(config);
  }

  /**
   * Check if a skill name is registered.
   * @param name - The skill name to check.
   * @returns True if the skill is registered.
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Get the manifest for a registered skill, if available.
   * @param name - The skill name to look up.
   * @returns The skill manifest, or undefined if not found or not provided.
   */
  getManifest(name: string): SkillManifest | undefined {
    return this.registry.get(name)?.manifest;
  }

  /**
   * List all registered skill names.
   * @returns Array of registered skill name strings.
   */
  listRegistered(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List all registered skills with their optional manifests.
   * @returns Array of objects containing skill name and manifest.
   */
  listRegisteredWithManifests(): { name: string; manifest?: SkillManifest }[] {
    return Array.from(this.registry.values()).map(e => ({
      name: e.name,
      manifest: e.manifest,
    }));
  }

  /**
   * Add a directory path to search during skill discovery.
   * @param path - Absolute path to a directory containing skill files.
   */
  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path);
    }
  }

  /**
   * Get all configured search paths for skill discovery.
   * @returns Copy of the search paths array.
   */
  getSearchPaths(): string[] {
    return [...this.searchPaths];
  }

  /**
   * Discover and register skills from a directory by importing each file.
   * Looks for modules exporting a `createSkill` factory or a SkillBase default export.
   * @param dirPath - Absolute path to the directory to scan.
   * @returns Array of newly discovered skill names.
   */
  async discoverFromDirectory(dirPath: string): Promise<string[]> {
    if (process.env['SWML_SKILL_DISCOVERY_ENABLED'] !== 'true') {
      log.warn('Skill directory discovery is disabled. Set SWML_SKILL_DISCOVERY_ENABLED=true to enable.');
      return [];
    }
    const { readdir } = await import('node:fs/promises');
    const { join } = await import('node:path');
    const { pathToFileURL } = await import('node:url');

    const discovered: string[] = [];
    let entries: string[];

    try {
      const dirEntries = await readdir(dirPath, { withFileTypes: true });
      entries = dirEntries
        .filter(e => (e.isFile() && (e.name.endsWith('.ts') || e.name.endsWith('.js'))) || e.isDirectory())
        .map(e => e.name);
    } catch {
      log.warn(`Cannot read skill directory: ${dirPath}`);
      return discovered;
    }

    for (const entry of entries) {
      const fullPath = join(dirPath, entry);
      try {
        const fileUrl = pathToFileURL(
          entry.endsWith('.ts') || entry.endsWith('.js') ? fullPath : join(fullPath, 'skill.ts'),
        ).href;
        const mod = await import(fileUrl);

        // Look for a factory function or a SkillBase subclass
        if (typeof mod.createSkill === 'function') {
          const name = entry.replace(/\.(ts|js)$/, '');
          this.register(name, mod.createSkill);
          discovered.push(name);
        } else if (typeof mod.default === 'function' && mod.default.prototype instanceof SkillBase) {
          const name = entry.replace(/\.(ts|js)$/, '');
          this.register(name, (config) => new mod.default(config));
          discovered.push(name);
        }
      } catch (err) {
        log.debug(`Could not load skill from ${fullPath}: ${err}`);
      }
    }

    return discovered;
  }

  /**
   * Discover and register skills from all configured search paths.
   * @returns Array of all newly discovered skill names.
   */
  async discoverAll(): Promise<string[]> {
    const all: string[] = [];
    for (const path of this.searchPaths) {
      const found = await this.discoverFromDirectory(path);
      all.push(...found);
    }
    return all;
  }

  /**
   * Get the combined schema info for a registered skill, including manifest and parameter schema.
   * Creates a temporary instance to extract the schema.
   * @param name - The registered skill name to query.
   * @returns The skill's combined schema info, or undefined if not found.
   */
  getSkillSchema(name: string): SkillSchemaInfo | undefined {
    const entry = this.registry.get(name);
    if (!entry) return undefined;

    try {
      const instance = entry.factory();
      const manifest = instance.getManifest();
      const SkillClass = instance.constructor as typeof SkillBase;
      const parameters = SkillClass.getParameterSchema();

      return {
        name: manifest.name,
        description: manifest.description,
        version: manifest.version,
        supportsMultipleInstances: SkillClass.SUPPORTS_MULTIPLE_INSTANCES,
        requiredEnvVars: manifest.requiredEnvVars ?? [],
        parameters,
        source: manifest.tags?.includes('external') ? 'external' : 'builtin',
      };
    } catch (err) {
      log.warn(`Failed to get schema for skill '${name}': ${err}`);
      return undefined;
    }
  }

  /**
   * Get combined schema info for all registered skills.
   * @returns Record mapping skill names to their schema info.
   */
  getAllSkillsSchema(): Record<string, SkillSchemaInfo> {
    const result: Record<string, SkillSchemaInfo> = {};
    for (const name of this.registry.keys()) {
      const schema = this.getSkillSchema(name);
      if (schema) result[name] = schema;
    }
    return result;
  }

  /**
   * List all registered skill names grouped by source category.
   * @returns Record mapping source categories to arrays of skill names.
   */
  listAllSkillSources(): Record<string, string[]> {
    const groups: Record<string, string[]> = {};
    for (const name of this.registry.keys()) {
      const schema = this.getSkillSchema(name);
      const source = schema?.source ?? 'unknown';
      if (!groups[source]) groups[source] = [];
      groups[source].push(name);
    }
    return groups;
  }

  /**
   * Get the number of registered skills.
   * @returns The count of registered skills.
   */
  get size(): number {
    return this.registry.size;
  }

  /**
   * Clear all registrations.
   */
  clear(): void {
    this.registry.clear();
  }
}
