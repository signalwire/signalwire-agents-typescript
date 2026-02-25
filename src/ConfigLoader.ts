/**
 * ConfigLoader - JSON config file loader with env var interpolation.
 *
 * Supports ${VAR|default} syntax for env var substitution and
 * dot-notation access for nested values.
 */

import { readFileSync, existsSync } from 'node:fs';
import { resolve, join } from 'node:path';

const ENV_VAR_PATTERN = /\$\{([^}|]+)(?:\|([^}]*))?\}/g;

/** JSON configuration file loader with environment variable interpolation and dot-notation access. */
export class ConfigLoader {
  private data: Record<string, unknown> = {};
  private filePath: string | null = null;

  /**
   * Create a new ConfigLoader, optionally loading a JSON file immediately.
   * @param filePath - Path to a JSON config file to load on construction.
   */
  constructor(filePath?: string) {
    if (filePath) {
      this.load(filePath);
    }
  }

  /**
   * Load configuration from a JSON file, performing `${VAR|default}` env var interpolation on the raw text.
   * @param filePath - Path to the JSON config file.
   * @returns This instance for chaining.
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
   * Search for a config file in standard locations (CWD, `./config`, `$HOME/.signalwire`).
   * @param filename - The config file name to search for.
   * @returns A loaded ConfigLoader if found, or null if the file does not exist in any search path.
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
   * Retrieve a configuration value using a dot-notation path (e.g. `'server.port'`).
   * @param path - Dot-separated key path into the config object.
   * @param defaultValue - Value returned when the path does not exist.
   * @returns The resolved value, or defaultValue if not found.
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
   * Set a configuration value at the given dot-notation path, creating intermediate objects as needed.
   * @param path - Dot-separated key path into the config object.
   * @param value - The value to store.
   * @returns This instance for chaining.
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
   * Check whether a dot-notation path exists in the loaded configuration.
   * @param path - Dot-separated key path to check.
   * @returns True if the path resolves to a defined value.
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
   * Return a shallow copy of the entire configuration object.
   * @returns A copy of the top-level config data.
   */
  getAll(): Record<string, unknown> {
    return { ...this.data };
  }

  /**
   * Return the absolute path of the loaded config file, if any.
   * @returns The file path, or null if config was loaded from an object.
   */
  getFilePath(): string | null {
    return this.filePath;
  }

  /**
   * Load configuration from a plain object instead of a file, useful for testing or programmatic setup.
   * @param obj - The configuration object to use.
   * @returns This instance for chaining.
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
