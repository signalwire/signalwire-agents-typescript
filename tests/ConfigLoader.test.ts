import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ConfigLoader } from '../src/ConfigLoader.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(process.cwd(), '__config_test_tmp__');

describe('ConfigLoader', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'test.json'), JSON.stringify({
      server: { host: '0.0.0.0', port: 3000 },
      name: 'test-agent',
      nested: { deep: { value: 42 } },
    }));
    writeFileSync(join(TEST_DIR, 'env-test.json'), JSON.stringify({
      host: '${TEST_CONFIG_HOST|localhost}',
      port: '${TEST_CONFIG_PORT|8080}',
      secret: '${TEST_CONFIG_SECRET}',
    }));
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('loads a JSON config file', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.get('name')).toBe('test-agent');
  });

  it('dot-notation access for nested values', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.get('server.host')).toBe('0.0.0.0');
    expect(config.get('server.port')).toBe(3000);
    expect(config.get('nested.deep.value')).toBe(42);
  });

  it('returns default value for missing path', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.get('missing', 'fallback')).toBe('fallback');
    expect(config.get('server.missing', 99)).toBe(99);
  });

  it('has() checks path existence', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.has('name')).toBe(true);
    expect(config.has('server.host')).toBe(true);
    expect(config.has('nope')).toBe(false);
    expect(config.has('server.nope')).toBe(false);
  });

  it('set() sets values with dot-notation', () => {
    const config = new ConfigLoader();
    config.loadFromObject({});
    config.set('server.port', 5000);
    config.set('name', 'new-agent');
    expect(config.get('server.port')).toBe(5000);
    expect(config.get('name')).toBe('new-agent');
  });

  it('getAll() returns all config data', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    const all = config.getAll();
    expect(all.name).toBe('test-agent');
    expect(all.server).toBeDefined();
  });

  it('interpolates env vars with defaults', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'env-test.json'));
    expect(config.get('host')).toBe('localhost');
    expect(config.get('port')).toBe('8080');
    // secret has no default and no env var, so empty string
    expect(config.get('secret')).toBe('');
  });

  it('interpolates env vars from environment', () => {
    process.env['TEST_CONFIG_HOST'] = 'myhost.com';
    try {
      const config = new ConfigLoader(join(TEST_DIR, 'env-test.json'));
      expect(config.get('host')).toBe('myhost.com');
    } finally {
      delete process.env['TEST_CONFIG_HOST'];
    }
  });

  it('throws for missing file', () => {
    expect(() => new ConfigLoader('/nonexistent/path.json')).toThrow('Config file not found');
  });

  it('loadFromObject works', () => {
    const config = new ConfigLoader();
    config.loadFromObject({ key: 'value', nested: { a: 1 } });
    expect(config.get('key')).toBe('value');
    expect(config.get('nested.a')).toBe(1);
    expect(config.getFilePath()).toBeNull();
  });

  it('getFilePath returns the loaded file path', () => {
    const config = new ConfigLoader(join(TEST_DIR, 'test.json'));
    expect(config.getFilePath()).toContain('test.json');
  });

  it('load returns this for chaining', () => {
    const config = new ConfigLoader();
    const result = config.load(join(TEST_DIR, 'test.json'));
    expect(result).toBe(config);
  });

  it('set creates intermediate objects', () => {
    const config = new ConfigLoader();
    config.loadFromObject({});
    config.set('a.b.c', 'deep');
    expect(config.get('a.b.c')).toBe('deep');
  });

  it('search returns null when file not found', () => {
    const result = ConfigLoader.search('nonexistent-file-12345.json');
    expect(result).toBeNull();
  });
});
