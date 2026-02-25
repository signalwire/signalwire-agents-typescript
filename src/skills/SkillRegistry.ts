/**
 * SkillRegistry - Global singleton registry for discovering and loading skills.
 *
 * Skills can be registered programmatically or discovered from directories.
 * Supports SIGNALWIRE_SKILL_PATHS env var for custom skill directories.
 */

import { SkillBase, type SkillConfig, type SkillManifest } from './SkillBase.js';
import { getLogger } from '../Logger.js';

const log = getLogger('SkillRegistry');

export type SkillFactory = (config?: SkillConfig) => SkillBase;

interface RegistryEntry {
  name: string;
  factory: SkillFactory;
  manifest?: SkillManifest;
}

let _instance: SkillRegistry | null = null;

export class SkillRegistry {
  private registry: Map<string, RegistryEntry> = new Map();
  private searchPaths: string[];

  constructor() {
    const envPaths = process.env['SIGNALWIRE_SKILL_PATHS'];
    this.searchPaths = envPaths ? envPaths.split(':').filter(Boolean) : [];
  }

  /**
   * Get the global singleton instance.
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
   * Register a skill factory by name.
   */
  register(name: string, factory: SkillFactory, manifest?: SkillManifest): void {
    if (this.registry.has(name)) {
      log.warn(`Overwriting skill registration: ${name}`);
    }
    this.registry.set(name, { name, factory, manifest });
    log.debug(`Registered skill: ${name}`);
  }

  /**
   * Unregister a skill by name.
   */
  unregister(name: string): boolean {
    return this.registry.delete(name);
  }

  /**
   * Create a skill instance by name.
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
   * Check if a skill is registered.
   */
  has(name: string): boolean {
    return this.registry.has(name);
  }

  /**
   * Get the manifest for a registered skill.
   */
  getManifest(name: string): SkillManifest | undefined {
    return this.registry.get(name)?.manifest;
  }

  /**
   * List all registered skill names.
   */
  listRegistered(): string[] {
    return Array.from(this.registry.keys());
  }

  /**
   * List all registered skills with their manifests.
   */
  listRegisteredWithManifests(): { name: string; manifest?: SkillManifest }[] {
    return Array.from(this.registry.values()).map(e => ({
      name: e.name,
      manifest: e.manifest,
    }));
  }

  /**
   * Add a search path for skill discovery.
   */
  addSearchPath(path: string): void {
    if (!this.searchPaths.includes(path)) {
      this.searchPaths.push(path);
    }
  }

  /**
   * Get all search paths.
   */
  getSearchPaths(): string[] {
    return [...this.searchPaths];
  }

  /**
   * Discover and register skills from a directory.
   * Looks for files exporting a SkillBase subclass or a factory function.
   */
  async discoverFromDirectory(dirPath: string): Promise<string[]> {
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
   * Discover skills from all configured search paths.
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
   * Get the count of registered skills.
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
