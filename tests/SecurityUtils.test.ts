import { describe, it, expect } from 'vitest';
import {
  safeAssign,
  isPrivateIp,
  resolveAndValidateUrl,
  filterSensitiveHeaders,
  redactUrl,
  isValidHostname,
  MAX_SKILL_INPUT_LENGTH,
} from '../src/SecurityUtils.js';

describe('SecurityUtils', () => {
  // ── safeAssign ──────────────────────────────────────────────────────
  describe('safeAssign', () => {
    it('copies normal keys', () => {
      const target: Record<string, unknown> = { a: 1 };
      safeAssign(target, { b: 2, c: 3 });
      expect(target).toEqual({ a: 1, b: 2, c: 3 });
    });

    it('blocks __proto__ key', () => {
      const target: Record<string, unknown> = {};
      // Use Object.create to construct a source with a literal __proto__ own property
      const source = Object.create(null) as Record<string, unknown>;
      source['__proto__'] = { polluted: true };
      source['safe'] = 'ok';
      safeAssign(target, source);
      expect(target['safe']).toBe('ok');
      expect(({} as any).polluted).toBeUndefined();
      // __proto__ should not have been copied as an own property
      expect(Object.prototype.hasOwnProperty.call(target, '__proto__')).toBe(false);
    });

    it('blocks constructor key', () => {
      const target: Record<string, unknown> = {};
      const source = Object.create(null) as Record<string, unknown>;
      source['constructor'] = 'bad';
      source['normal'] = 'ok';
      safeAssign(target, source);
      // constructor should not have been set as an own property
      expect(Object.prototype.hasOwnProperty.call(target, 'constructor')).toBe(false);
      expect(target['normal']).toBe('ok');
    });

    it('blocks prototype key', () => {
      const target: Record<string, unknown> = {};
      const source = Object.create(null) as Record<string, unknown>;
      source['prototype'] = 'bad';
      source['key'] = 'val';
      safeAssign(target, source);
      expect(Object.prototype.hasOwnProperty.call(target, 'prototype')).toBe(false);
      expect(target['key']).toBe('val');
    });
  });

  // ── isPrivateIp ─────────────────────────────────────────────────────
  describe('isPrivateIp', () => {
    it('identifies 127.x as private', () => {
      expect(isPrivateIp('127.0.0.1')).toBe(true);
      expect(isPrivateIp('127.255.255.255')).toBe(true);
    });

    it('identifies 10.x as private', () => {
      expect(isPrivateIp('10.0.0.1')).toBe(true);
      expect(isPrivateIp('10.255.255.255')).toBe(true);
    });

    it('identifies 172.16-31.x as private', () => {
      expect(isPrivateIp('172.16.0.1')).toBe(true);
      expect(isPrivateIp('172.31.255.255')).toBe(true);
      expect(isPrivateIp('172.15.0.1')).toBe(false);
      expect(isPrivateIp('172.32.0.1')).toBe(false);
    });

    it('identifies 192.168.x as private', () => {
      expect(isPrivateIp('192.168.1.1')).toBe(true);
    });

    it('identifies 169.254.x as private', () => {
      expect(isPrivateIp('169.254.0.1')).toBe(true);
    });

    it('identifies IPv6 loopback ::1 as private', () => {
      expect(isPrivateIp('::1')).toBe(true);
    });

    it('identifies fc/fd prefixes as private', () => {
      expect(isPrivateIp('fc00::1')).toBe(true);
      expect(isPrivateIp('fd12::1')).toBe(true);
    });

    it('identifies fe80 link-local as private', () => {
      expect(isPrivateIp('fe80::1')).toBe(true);
    });

    it('returns false for public IPs', () => {
      expect(isPrivateIp('8.8.8.8')).toBe(false);
      expect(isPrivateIp('1.1.1.1')).toBe(false);
      expect(isPrivateIp('203.0.113.1')).toBe(false);
    });
  });

  // ── resolveAndValidateUrl ───────────────────────────────────────────
  describe('resolveAndValidateUrl', () => {
    it('rejects http://127.0.0.1/', async () => {
      await expect(resolveAndValidateUrl('http://127.0.0.1/')).rejects.toThrow('private IP');
    });

    it('rejects http://10.0.0.1/', async () => {
      await expect(resolveAndValidateUrl('http://10.0.0.1/')).rejects.toThrow('private IP');
    });

    it('passes with allowPrivate=true', async () => {
      await expect(resolveAndValidateUrl('http://127.0.0.1/', true)).resolves.toBeUndefined();
    });

    it('rejects invalid URLs', async () => {
      await expect(resolveAndValidateUrl('not-a-url')).rejects.toThrow('Invalid URL');
    });
  });

  // ── filterSensitiveHeaders ──────────────────────────────────────────
  describe('filterSensitiveHeaders', () => {
    it('removes authorization and cookie, keeps content-type and host', () => {
      const headers = {
        'authorization': 'Bearer secret',
        'cookie': 'session=abc',
        'content-type': 'application/json',
        'host': 'example.com',
        'x-api-key': 'key123',
        'proxy-authorization': 'Basic xxx',
      };
      const filtered = filterSensitiveHeaders(headers);
      expect(filtered).toEqual({
        'content-type': 'application/json',
        'host': 'example.com',
      });
    });

    it('handles case-insensitive header names', () => {
      const headers = {
        'Authorization': 'Bearer secret',
        'Content-Type': 'application/json',
      };
      const filtered = filterSensitiveHeaders(headers);
      expect(filtered).toEqual({ 'Content-Type': 'application/json' });
    });
  });

  // ── redactUrl ───────────────────────────────────────────────────────
  describe('redactUrl', () => {
    it('redacts password in https://user:secret@host.com', () => {
      expect(redactUrl('https://user:secret@host.com/path')).toBe('https://user:****@host.com/path');
    });

    it('is no-op without credentials', () => {
      expect(redactUrl('https://host.com/path')).toBe('https://host.com/path');
    });

    it('redacts in http URLs', () => {
      expect(redactUrl('http://admin:p4ss@localhost:3000')).toBe('http://admin:****@localhost:3000');
    });
  });

  // ── isValidHostname ─────────────────────────────────────────────────
  describe('isValidHostname', () => {
    it('rejects empty strings', () => {
      expect(isValidHostname('')).toBe(false);
    });

    it('rejects strings with whitespace', () => {
      expect(isValidHostname('host name.com')).toBe(false);
      expect(isValidHostname('host\tname')).toBe(false);
    });

    it('rejects strings with slashes', () => {
      expect(isValidHostname('host/path')).toBe(false);
      expect(isValidHostname('host\\path')).toBe(false);
    });

    it('accepts valid hostnames', () => {
      expect(isValidHostname('example.com')).toBe(true);
      expect(isValidHostname('sub.example.com')).toBe(true);
      expect(isValidHostname('localhost')).toBe(true);
    });
  });

  // ── MAX_SKILL_INPUT_LENGTH ──────────────────────────────────────────
  it('MAX_SKILL_INPUT_LENGTH is 1000', () => {
    expect(MAX_SKILL_INPUT_LENGTH).toBe(1000);
  });
});
