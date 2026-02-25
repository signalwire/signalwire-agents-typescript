import { describe, it, expect } from 'vitest';
import { SchemaUtils } from '../src/SchemaUtils.js';

describe('SchemaUtils', () => {
  it('validates a minimal valid SWML document', () => {
    const validator = new SchemaUtils();
    const result = validator.validate({
      version: '1.0.0',
      sections: { main: [] },
    });
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it('rejects missing version', () => {
    const validator = new SchemaUtils();
    const result = validator.validate({ sections: { main: [] } });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('version'))).toBe(true);
  });

  it('rejects missing sections', () => {
    const validator = new SchemaUtils();
    const result = validator.validate({ version: '1.0.0' });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('sections'))).toBe(true);
  });

  it('rejects invalid version', () => {
    const validator = new SchemaUtils();
    const result = validator.validate({
      version: '2.0.0',
      sections: { main: [] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('Invalid version'))).toBe(true);
  });

  it('rejects missing main section', () => {
    const validator = new SchemaUtils();
    const result = validator.validate({
      version: '1.0.0',
      sections: { other: [] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('main'))).toBe(true);
  });

  it('validates SWML from JSON string', () => {
    const validator = new SchemaUtils();
    const result = validator.validate(JSON.stringify({
      version: '1.0.0',
      sections: { main: [{ answer: {} }] },
    }));
    expect(result.valid).toBe(true);
  });

  it('rejects invalid JSON string', () => {
    const validator = new SchemaUtils();
    const result = validator.validate('not json');
    expect(result.valid).toBe(false);
    expect(result.errors).toContain('Invalid JSON');
  });

  it('validates AI verb with prompt', () => {
    const validator = new SchemaUtils();
    const result = validator.validate({
      version: '1.0.0',
      sections: { main: [{ ai: { prompt: { text: 'Hello' } } }] },
    });
    expect(result.valid).toBe(true);
  });

  it('rejects AI verb with empty prompt', () => {
    const validator = new SchemaUtils();
    const result = validator.validate({
      version: '1.0.0',
      sections: { main: [{ ai: { prompt: {} } }] },
    });
    expect(result.valid).toBe(false);
    expect(result.errors.some(e => e.includes('prompt'))).toBe(true);
  });

  it('caches validation results', () => {
    const validator = new SchemaUtils();
    const doc = JSON.stringify({ version: '1.0.0', sections: { main: [] } });
    validator.validate(doc);
    expect(validator.getCacheSize()).toBe(1);
    validator.validate(doc); // should hit cache
    expect(validator.getCacheSize()).toBe(1);
  });

  it('clearCache empties the cache', () => {
    const validator = new SchemaUtils();
    validator.validate({ version: '1.0.0', sections: { main: [] } });
    expect(validator.getCacheSize()).toBe(1);
    validator.clearCache();
    expect(validator.getCacheSize()).toBe(0);
  });

  it('skipValidation always returns valid', () => {
    const validator = new SchemaUtils({ skipValidation: true });
    const result = validator.validate({ invalid: true } as any);
    expect(result.valid).toBe(true);
  });
});
