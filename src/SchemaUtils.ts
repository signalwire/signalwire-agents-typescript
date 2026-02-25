/**
 * SchemaUtils - JSON Schema validation for SWML documents.
 *
 * Provides basic structural validation of rendered SWML.
 * Set SWML_SKIP_SCHEMA_VALIDATION=true to disable.
 */

/** Result of validating a SWML document. */
export interface ValidationResult {
  /** Whether the document passed all validation checks. */
  valid: boolean;
  /** List of human-readable error messages; empty when valid. */
  errors: string[];
}

// Basic SWML structure expectations
const REQUIRED_TOP_LEVEL = ['version', 'sections'];
const VALID_VERSIONS = ['1.0.0'];

/** Validates SWML documents against structural rules with an LRU-style result cache. */
export class SchemaUtils {
  private skipValidation: boolean;
  private cache: Map<string, ValidationResult> = new Map();
  private maxCacheSize: number;

  /**
   * Create a SchemaUtils instance.
   * @param opts - Optional settings for skipping validation or limiting cache size.
   */
  constructor(opts?: { skipValidation?: boolean; maxCacheSize?: number }) {
    this.skipValidation = opts?.skipValidation ?? (process.env['SWML_SKIP_SCHEMA_VALIDATION'] === 'true');
    this.maxCacheSize = opts?.maxCacheSize ?? 100;
  }

  /**
   * Validate a SWML document against structural rules.
   * @param swml - The SWML document as a JSON string or parsed object.
   * @returns The validation result indicating success or a list of errors.
   */
  validate(swml: string | Record<string, unknown>): ValidationResult {
    if (this.skipValidation) {
      return { valid: true, errors: [] };
    }

    const swmlStr = typeof swml === 'string' ? swml : JSON.stringify(swml);

    // Check cache
    const cached = this.cache.get(swmlStr);
    if (cached) return cached;

    const errors: string[] = [];
    let doc: Record<string, unknown>;

    try {
      doc = typeof swml === 'string' ? JSON.parse(swml) : swml;
    } catch {
      const result: ValidationResult = { valid: false, errors: ['Invalid JSON'] };
      this.cacheResult(swmlStr, result);
      return result;
    }

    // Check top-level required keys
    for (const key of REQUIRED_TOP_LEVEL) {
      if (!(key in doc)) {
        errors.push(`Missing required top-level key: ${key}`);
      }
    }

    // Check version
    if (doc['version'] && !VALID_VERSIONS.includes(doc['version'] as string)) {
      errors.push(`Invalid version: ${doc['version']}. Expected one of: ${VALID_VERSIONS.join(', ')}`);
    }

    // Check sections
    if (doc['sections']) {
      if (typeof doc['sections'] !== 'object' || Array.isArray(doc['sections'])) {
        errors.push('sections must be an object');
      } else {
        const sections = doc['sections'] as Record<string, unknown>;
        if (!('main' in sections)) {
          errors.push('sections must contain a "main" section');
        }
        // Validate each section is an array
        for (const [name, section] of Object.entries(sections)) {
          if (!Array.isArray(section)) {
            errors.push(`Section "${name}" must be an array`);
          }
        }
      }
    }

    // Validate AI verb structure if present
    if (doc['sections'] && typeof doc['sections'] === 'object') {
      const sections = doc['sections'] as Record<string, unknown[]>;
      const main = sections['main'];
      if (Array.isArray(main)) {
        for (const verb of main) {
          if (typeof verb === 'object' && verb !== null && 'ai' in verb) {
            this.validateAiVerb((verb as Record<string, unknown>)['ai'] as Record<string, unknown>, errors);
          }
        }
      }
    }

    const result: ValidationResult = {
      valid: errors.length === 0,
      errors,
    };
    this.cacheResult(swmlStr, result);
    return result;
  }

  private validateAiVerb(ai: Record<string, unknown>, errors: string[]): void {
    if (!ai) return;

    // Prompt must have text
    if (ai['prompt']) {
      const prompt = ai['prompt'] as Record<string, unknown>;
      if (typeof prompt === 'object' && !prompt['text']) {
        errors.push('AI prompt must have a "text" field');
      }
    }

    // SWAIG validation
    if (ai['SWAIG']) {
      const swaig = ai['SWAIG'] as Record<string, unknown>;
      if (swaig['functions'] && !Array.isArray(swaig['functions'])) {
        errors.push('SWAIG functions must be an array');
      }
      if (Array.isArray(swaig['functions'])) {
        for (let i = 0; i < (swaig['functions'] as unknown[]).length; i++) {
          const fn = (swaig['functions'] as Record<string, unknown>[])[i];
          if (!fn['function']) {
            errors.push(`SWAIG function at index ${i} missing "function" name`);
          }
        }
      }
    }

    // Post-prompt validation
    if (ai['post_prompt']) {
      const pp = ai['post_prompt'] as Record<string, unknown>;
      if (typeof pp === 'object' && !pp['text']) {
        errors.push('AI post_prompt must have a "text" field');
      }
    }
  }

  /** Clear the validation cache */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * Get the number of cached validation results.
   * @returns The current cache entry count.
   */
  getCacheSize(): number {
    return this.cache.size;
  }

  private cacheResult(key: string, result: ValidationResult): void {
    if (this.cache.size >= this.maxCacheSize) {
      // Remove oldest entry
      const firstKey = this.cache.keys().next().value;
      if (firstKey) this.cache.delete(firstKey);
    }
    this.cache.set(key, result);
  }
}
