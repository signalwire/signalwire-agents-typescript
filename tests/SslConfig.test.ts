import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { SslConfig } from '../src/SslConfig.js';
import { writeFileSync, mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

const TEST_DIR = join(process.cwd(), '__ssl_test_tmp__');

describe('SslConfig', () => {
  beforeAll(() => {
    mkdirSync(TEST_DIR, { recursive: true });
    writeFileSync(join(TEST_DIR, 'cert.pem'), '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----');
    writeFileSync(join(TEST_DIR, 'key.pem'), '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----');
  });

  afterAll(() => {
    rmSync(TEST_DIR, { recursive: true, force: true });
  });

  it('defaults to disabled', () => {
    const ssl = new SslConfig();
    expect(ssl.enabled).toBe(false);
    expect(ssl.isConfigured()).toBe(false);
  });

  it('can be enabled via options', () => {
    const ssl = new SslConfig({
      enabled: true,
      certPath: join(TEST_DIR, 'cert.pem'),
      keyPath: join(TEST_DIR, 'key.pem'),
    });
    expect(ssl.enabled).toBe(true);
    expect(ssl.isConfigured()).toBe(true);
  });

  it('isConfigured returns false when files missing', () => {
    const ssl = new SslConfig({
      enabled: true,
      certPath: '/nonexistent/cert.pem',
      keyPath: '/nonexistent/key.pem',
    });
    expect(ssl.isConfigured()).toBe(false);
  });

  it('getCert reads certificate file', () => {
    const ssl = new SslConfig({
      enabled: true,
      certPath: join(TEST_DIR, 'cert.pem'),
      keyPath: join(TEST_DIR, 'key.pem'),
    });
    const cert = ssl.getCert();
    expect(cert).toContain('BEGIN CERTIFICATE');
  });

  it('getKey reads key file', () => {
    const ssl = new SslConfig({
      enabled: true,
      certPath: join(TEST_DIR, 'cert.pem'),
      keyPath: join(TEST_DIR, 'key.pem'),
    });
    const key = ssl.getKey();
    expect(key).toContain('BEGIN PRIVATE KEY');
  });

  it('getCert returns null for missing file', () => {
    const ssl = new SslConfig({ enabled: true, certPath: '/missing' });
    expect(ssl.getCert()).toBeNull();
  });

  it('getHstsHeader returns HSTS value when enabled', () => {
    const ssl = new SslConfig({ enabled: true, hsts: true });
    const header = ssl.getHstsHeader();
    expect(header).toContain('max-age=31536000');
    expect(header).toContain('includeSubDomains');
  });

  it('getHstsHeader returns null when disabled', () => {
    const ssl = new SslConfig({ enabled: false });
    expect(ssl.getHstsHeader()).toBeNull();
  });

  it('getServerOptions returns cert and key', () => {
    const ssl = new SslConfig({
      enabled: true,
      certPath: join(TEST_DIR, 'cert.pem'),
      keyPath: join(TEST_DIR, 'key.pem'),
    });
    const opts = ssl.getServerOptions();
    expect(opts).not.toBeNull();
    expect(opts!.cert).toContain('CERTIFICATE');
    expect(opts!.key).toContain('PRIVATE KEY');
  });

  it('getServerOptions returns null when files missing', () => {
    const ssl = new SslConfig({ enabled: true });
    expect(ssl.getServerOptions()).toBeNull();
  });
});
