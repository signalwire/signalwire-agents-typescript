import { describe, it, expect } from 'vitest';
import { SessionManager } from '../src/SessionManager.js';

describe('SessionManager', () => {
  it('createSession generates an ID when none provided', () => {
    const sm = new SessionManager();
    const id = sm.createSession();
    expect(id).toBeTruthy();
    expect(typeof id).toBe('string');
  });

  it('createSession returns provided ID', () => {
    const sm = new SessionManager();
    expect(sm.createSession('my-call')).toBe('my-call');
  });

  it('generateToken produces a base64url string', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('get_time', 'call-1');
    expect(typeof token).toBe('string');
    // Should be valid base64url
    expect(() => Buffer.from(token, 'base64url').toString()).not.toThrow();
  });

  it('validateToken accepts a valid token', () => {
    const sm = new SessionManager();
    const callId = 'call-1';
    const fn = 'get_time';
    const token = sm.generateToken(fn, callId);
    expect(sm.validateToken(callId, fn, token)).toBe(true);
  });

  it('validateToken rejects wrong function name', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn_a', 'call-1');
    expect(sm.validateToken('call-1', 'fn_b', token)).toBe(false);
  });

  it('validateToken rejects wrong call id', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn', 'call-1');
    expect(sm.validateToken('call-2', 'fn', token)).toBe(false);
  });

  it('validateToken rejects expired tokens', () => {
    const sm = new SessionManager(0); // 0 second expiry
    const token = sm.generateToken('fn', 'call-1');
    // Token is immediately expired (or within ms)
    // Wait a tiny bit to ensure expiry
    const result = sm.validateToken('call-1', 'fn', token);
    // With 0 expiry the token expires at creation time, so it should be invalid
    expect(result).toBe(false);
  });

  it('validateToken rejects tampered tokens', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn', 'call-1');
    // Tamper with the token
    const tampered = token.slice(0, -2) + 'XX';
    expect(sm.validateToken('call-1', 'fn', tampered)).toBe(false);
  });

  it('validateToken rejects tokens from different secret', () => {
    const sm1 = new SessionManager(3600, 'secret-1');
    const sm2 = new SessionManager(3600, 'secret-2');
    const token = sm1.generateToken('fn', 'call-1');
    expect(sm2.validateToken('call-1', 'fn', token)).toBe(false);
  });

  it('aliases work', () => {
    const sm = new SessionManager();
    const callId = 'call-1';
    const fn = 'fn';
    const token = sm.createToolToken(fn, callId);
    expect(sm.validateToolToken(fn, token, callId)).toBe(true);
  });

  it('validates token when callId is empty (uses token callId)', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn', 'call-1');
    // Empty callId should use token's embedded callId
    expect(sm.validateToken('', 'fn', token)).toBe(true);
  });

  // ── Pass 1: debugToken + session metadata ────────────────────────

  it('debugToken decodes token components', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('get_time', 'call-42');
    const info = sm.debugToken(token);
    expect(info).not.toBeNull();
    expect(info!.callId).toBe('call-42');
    expect(info!.functionName).toBe('get_time');
    expect(typeof info!.expiry).toBe('number');
    expect(typeof info!.nonce).toBe('string');
    expect(typeof info!.signature).toBe('string');
    expect(info!.expired).toBe(false);
  });

  it('debugToken returns null for invalid token', () => {
    const sm = new SessionManager();
    expect(sm.debugToken('not-valid')).toBeNull();
  });

  it('debugToken shows expired status for expired tokens', () => {
    const sm = new SessionManager(0); // 0 second expiry
    const token = sm.generateToken('fn', 'call-1');
    const info = sm.debugToken(token);
    expect(info).not.toBeNull();
    expect(info!.expired).toBe(true);
  });

  it('setSessionMetadata stores and retrieves metadata', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('session-1', { caller: 'John', topic: 'billing' });
    const meta = sm.getSessionMetadata('session-1');
    expect(meta).toEqual({ caller: 'John', topic: 'billing' });
  });

  it('setSessionMetadata merges with existing metadata', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('session-1', { caller: 'John' });
    sm.setSessionMetadata('session-1', { topic: 'billing' });
    const meta = sm.getSessionMetadata('session-1');
    expect(meta).toEqual({ caller: 'John', topic: 'billing' });
  });

  it('getSessionMetadata returns undefined for unknown session', () => {
    const sm = new SessionManager();
    expect(sm.getSessionMetadata('nope')).toBeUndefined();
  });

  it('deleteSessionMetadata removes metadata', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('session-1', { key: 'val' });
    expect(sm.deleteSessionMetadata('session-1')).toBe(true);
    expect(sm.getSessionMetadata('session-1')).toBeUndefined();
  });

  // ── Security remediation tests ─────────────────────────────────────

  it('token round-trip works with full-length HMAC', () => {
    const sm = new SessionManager();
    const token = sm.generateToken('fn_a', 'call-99');
    const info = sm.debugToken(token);
    expect(info).not.toBeNull();
    // Full SHA-256 hex digest is 64 chars
    expect(info!.signature.length).toBe(64);
    expect(sm.validateToken('call-99', 'fn_a', token)).toBe(true);
  });

  it('cleanup() removes stale entries', () => {
    const sm = new SessionManager(1); // 1 second expiry
    sm.setSessionMetadata('old-session', { a: 1 });
    // Artificially age the entry by overwriting its timestamp
    (sm as any).sessionTimestamps.set('old-session', Date.now() - 5000);
    sm.cleanup();
    expect(sm.getSessionMetadata('old-session')).toBeUndefined();
  });

  it('cleanup(0) removes all entries', () => {
    const sm = new SessionManager();
    sm.setSessionMetadata('s1', { a: 1 });
    sm.setSessionMetadata('s2', { b: 2 });
    sm.cleanup(0);
    expect(sm.getSessionMetadata('s1')).toBeUndefined();
    expect(sm.getSessionMetadata('s2')).toBeUndefined();
  });

  it('boundary expiry token is rejected (expiry <= now)', () => {
    const sm = new SessionManager(0); // token expires at creation time
    const token = sm.generateToken('fn', 'call-1');
    // With <= comparison, a token expiring at exactly now should be invalid
    expect(sm.validateToken('call-1', 'fn', token)).toBe(false);
  });
});
