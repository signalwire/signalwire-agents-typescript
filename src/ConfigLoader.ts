/**
 * ConfigLoader - JSON config file loader with env var interpolation.
 *
 * Supports ${VAR|default} syntax for env var substitution and
 * dot-notation access for nested values.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ENV_VAR_PATTERN = /\$\{([^}|]+)(?:\|([^}]*))?\}/g;

export class ConfigLoader {
  private data: Record<string, unknown> = {};
  private filePath: string | null = null;

  constructor(filePath?: string) {
    if (filePath) {
      this.load(filePath);
    }
  }

  /**
   * Load config from a JSON file.
   * Supports ${VAR|default} env var interpolation in string values.
   */
  load(filePath: string): this {
    const absPath = resolve(filePath);
    if (!existsSync(absPath)) {
      throw new Error(`Config file not found: ${absPath}`);
    }
    const raw = readFileSync(absPath, 'utf-8');
    const interpolated = this.interpolateEnvVars(raw);
    this.data = JSON.parse(interpolated);
    this.filePath = absPath;
    return this;
  }

  /**
   * Search for a config file in standard locations.
   * Searches: CWD, ./config, $HOME/.signalwire
   */
  static search(filename: string): ConfigLoader | null {
    const searchPaths = [
      process.cwd(),
      join(process.cwd(), 'config'),
      join(process.env['HOME'] ?? '', '.signalwire'),
    ];

    for (const dir of searchPaths) {
      const filePath = join(dir, filename);
      if (existsSync(filePath)) {
        return new ConfigLoader(filePath);
      }
    }
    return null;
  }

  /**
   * Get a value using dot-notation path.
   * Example: get('server.port') returns config.server.port
   */
  get<T = unknown>(path: string, defaultValue?: T): T {
    const parts = path.split('.');
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return defaultValue as T;
      }
      current = (current as Record<string, unknown>)[part];
    }

    return (current !== undefined ? current : defaultValue) as T;
  }

  /**
   * Set a value using dot-notation path.
   */
  set(path: string, value: unknown): this {
    const parts = path.split('.');
    let current: Record<string, unknown> = this.data;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      if (!(part in current) || typeof current[part] !== 'object' || current[part] === null) {
        current[part] = {};
      }
      current = current[part] as Record<string, unknown>;
    }

    current[parts[parts.length - 1]] = value;
    return this;
  }

  /**
   * Check if a path exists in the config.
   */
  has(path: string): boolean {
    const parts = path.split('.');
    let current: unknown = this.data;

    for (const part of parts) {
      if (current === null || current === undefined || typeof current !== 'object') {
        return false;
      }
      if (!(part in (current as Record<string, unknown>))) return false;
      current = (current as Record<string, unknown>)[part];
    }
    return true;
  }

  /**
   * Get the entire config data.
   */
  getAll(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Get the file path that was loaded.
   */
  getFilePath(): string | null {
    return this.filePath;
  }

  /**
   * Load from a plain object (for testing or programmatic config).
   */
  loadFromObject(obj: Record<string, unknown>): this {
    this.data = { ...obj };
    this.filePath = null;
    return this;
  }

  /**
   * Interpolate ${VAR|default} patterns in a string.
   */
  private interpolateEnvVars(input: string): string {
    return input.replace(ENV_VAR_PATTERN, (_match, varName: string, defaultValue?: string) => {
      const envVal = process.env[varName.trim()];
      if (envVal !== undefined) return envVal;
      if (defaultValue !== undefined) return defaultValue;
      return '';
    });
  }
}
