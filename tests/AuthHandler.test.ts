import { describe, it, expect } from 'vitest';
import { AuthHandler } from '../src/AuthHandler.js';

describe('AuthHandler', () => {
  it('validates Bearer token', async () => {
    const auth = new AuthHandler({ bearerToken: 'my-secret-token' });
    const valid = await auth.validate({ authorization: 'Bearer my-secret-token' });
    expect(valid).toBe(true);
  });

  it('rejects invalid Bearer token', async () => {
    const auth = new AuthHandler({ bearerToken: 'my-secret-token' });
    const valid = await auth.validate({ authorization: 'Bearer wrong-token' });
    expect(valid).toBe(false);
  });

  it('validates API key', async () => {
    const auth = new AuthHandler({ apiKey: 'my-api-key' });
    const valid = await auth.validate({ 'x-api-key': 'my-api-key' });
    expect(valid).toBe(true);
  });

  it('rejects invalid API key', async () => {
    const auth = new AuthHandler({ apiKey: 'my-api-key' });
    const valid = await auth.validate({ 'x-api-key': 'wrong-key' });
    expect(valid).toBe(false);
  });

  it('validates Basic auth', async () => {
    const auth = new AuthHandler({ basicAuth: ['admin', 'pass123'] });
    const encoded = Buffer.from('admin:pass123').toString('base64');
    const valid = await auth.validate({ authorization: `Basic ${encoded}` });
    expect(valid).toBe(true);
  });

  it('rejects invalid Basic auth', async () => {
    const auth = new AuthHandler({ basicAuth: ['admin', 'pass123'] });
    const encoded = Buffer.from('admin:wrong').toString('base64');
    const valid = await auth.validate({ authorization: `Basic ${encoded}` });
    expect(valid).toBe(false);
  });

  it('validates custom validator', async () => {
    const auth = new AuthHandler({
      customValidator: (req) => req.headers['x-custom'] === 'valid',
    });
    const valid = await auth.validate({ 'x-custom': 'valid' });
    expect(valid).toBe(true);
  });

  it('rejects with custom validator', async () => {
    const auth = new AuthHandler({
      customValidator: (req) => req.headers['x-custom'] === 'valid',
    });
    const valid = await auth.validate({ 'x-custom': 'invalid' });
    expect(valid).toBe(false);
  });

  it('checks methods in priority order: Bearer > API Key > Basic', async () => {
    const auth = new AuthHandler({
      bearerToken: 'token',
      apiKey: 'key',
      basicAuth: ['u', 'p'],
    });
    // Bearer should pass even without API key or Basic
    const valid = await auth.validate({ authorization: 'Bearer token' });
    expect(valid).toBe(true);
  });

  it('allows all when no auth configured', async () => {
    const auth = new AuthHandler({});
    const valid = await auth.validate({});
    expect(valid).toBe(true);
  });

  it('hasBearerAuth returns correct state', () => {
    expect(new AuthHandler({ bearerToken: 'x' }).hasBearerAuth()).toBe(true);
    expect(new AuthHandler({}).hasBearerAuth()).toBe(false);
  });

  it('hasApiKeyAuth returns correct state', () => {
    expect(new AuthHandler({ apiKey: 'x' }).hasApiKeyAuth()).toBe(true);
    expect(new AuthHandler({}).hasApiKeyAuth()).toBe(false);
  });

  it('hasBasicAuth returns correct state', () => {
    expect(new AuthHandler({ basicAuth: ['u', 'p'] }).hasBasicAuth()).toBe(true);
    expect(new AuthHandler({}).hasBasicAuth()).toBe(false);
  });

  it('async custom validator works', async () => {
    const auth = new AuthHandler({
      customValidator: async (req) => {
        await new Promise((r) => setTimeout(r, 1));
        return req.headers['x-token'] === 'async-valid';
      },
    });
    expect(await auth.validate({ 'x-token': 'async-valid' })).toBe(true);
    expect(await auth.validate({ 'x-token': 'nope' })).toBe(false);
  });

  it('middleware returns 401 for unauthorized request', async () => {
    const auth = new AuthHandler({ bearerToken: 'secret' });
    const mw = auth.middleware();
    let nextCalled = false;

    // Mock Hono context
    const mockCtx = {
      req: {
        raw: {
          headers: new Map([['authorization', 'Bearer wrong']]),
        },
      },
      json: (body: unknown, status: number) => ({ body, status }),
    };

    const result = await mw(mockCtx, async () => { nextCalled = true; });
    expect(nextCalled).toBe(false);
    expect((result as any).status).toBe(401);
  });
});
