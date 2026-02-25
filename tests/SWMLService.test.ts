/**
 * Tests for SWMLService — non-AI SWML service.
 */

import { SWMLService } from '../src/SWMLService.js';
import { SwmlBuilder } from '../src/SwmlBuilder.js';

describe('SWMLService', () => {
  describe('constructor', () => {
    it('uses default name and route', () => {
      const svc = new SWMLService();
      expect(svc.name).toBe('swml-service');
      expect(svc.route).toBe('/');
    });

    it('accepts custom name, route, and basicAuth', () => {
      const svc = new SWMLService({
        name: 'ivr',
        route: '/ivr',
        basicAuth: ['admin', 'secret'],
      });
      expect(svc.name).toBe('ivr');
      expect(svc.route).toBe('/ivr');
    });
  });

  describe('addVerb', () => {
    it('adds verbs to the SWML document', () => {
      const svc = new SWMLService();
      svc.addVerb('answer', { max_duration: 300 });
      svc.addVerb('play', { url: 'say:Hello' });
      svc.addVerb('hangup', {});

      const doc = svc.renderSwml();
      expect(doc).toHaveProperty('version', '1.0.0');
      const main = (doc['sections'] as Record<string, unknown>)['main'] as unknown[];
      expect(main).toHaveLength(3);
      expect(main[0]).toEqual({ answer: { max_duration: 300 } });
      expect(main[1]).toEqual({ play: { url: 'say:Hello' } });
      expect(main[2]).toEqual({ hangup: {} });
    });

    it('returns this for chaining', () => {
      const svc = new SWMLService();
      const result = svc.addVerb('answer', {}).addVerb('hangup', {});
      expect(result).toBe(svc);
    });
  });

  describe('renderSwml', () => {
    it('returns valid SWML with no AI block', () => {
      const svc = new SWMLService();
      svc.addVerb('answer', {});
      const doc = svc.renderSwml();
      expect(doc).toHaveProperty('version', '1.0.0');
      expect(doc).toHaveProperty('sections');
      // No AI block
      const main = (doc['sections'] as Record<string, unknown>)['main'] as unknown[];
      for (const verb of main) {
        expect(verb).not.toHaveProperty('ai');
      }
    });

    it('returns empty main section when no verbs added', () => {
      const svc = new SWMLService();
      const doc = svc.renderSwml();
      const main = (doc['sections'] as Record<string, unknown>)['main'] as unknown[];
      expect(main).toEqual([]);
    });
  });

  describe('getBuilder', () => {
    it('returns the SwmlBuilder instance', () => {
      const svc = new SWMLService();
      const builder = svc.getBuilder();
      expect(builder).toBeInstanceOf(SwmlBuilder);
    });

    it('builder matches renderSwml output', () => {
      const svc = new SWMLService();
      svc.addVerb('answer', {});
      expect(svc.getBuilder().getDocument()).toEqual(svc.renderSwml());
    });
  });

  describe('setOnRequestCallback', () => {
    it('returns this for chaining', () => {
      const svc = new SWMLService();
      const result = svc.setOnRequestCallback(() => new SwmlBuilder());
      expect(result).toBe(svc);
    });
  });

  describe('getApp', () => {
    it('returns a Hono app', () => {
      const svc = new SWMLService();
      const app = svc.getApp();
      expect(app).toBeDefined();
      expect(typeof app.fetch).toBe('function');
    });

    it('GET / returns SWML JSON', async () => {
      const svc = new SWMLService();
      svc.addVerb('answer', {});
      svc.addVerb('hangup', {});

      const app = svc.getApp();
      const res = await app.request('/', { method: 'GET' });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json).toHaveProperty('version', '1.0.0');
      const main = json['sections']['main'];
      expect(main).toHaveLength(2);
    });

    it('POST / returns SWML JSON', async () => {
      const svc = new SWMLService();
      svc.addVerb('play', { url: 'say:Hi' });

      const app = svc.getApp();
      const res = await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      expect(res.status).toBe(200);
      const json = await res.json();
      expect(json['sections']['main']).toHaveLength(1);
    });

    it('GET /health returns ok', async () => {
      const svc = new SWMLService();
      const app = svc.getApp();
      const res = await app.request('/health', { method: 'GET' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ok' });
    });

    it('GET /ready returns ready', async () => {
      const svc = new SWMLService();
      const app = svc.getApp();
      const res = await app.request('/ready', { method: 'GET' });
      expect(res.status).toBe(200);
      expect(await res.json()).toEqual({ status: 'ready' });
    });

    it('enforces basic auth when configured', async () => {
      const svc = new SWMLService({
        basicAuth: ['admin', 'secret'],
      });
      svc.addVerb('answer', {});

      const app = svc.getApp();

      // Unauthorized
      const res1 = await app.request('/', { method: 'GET' });
      expect(res1.status).toBe(401);

      // Authorized
      const creds = Buffer.from('admin:secret').toString('base64');
      const res2 = await app.request('/', {
        method: 'GET',
        headers: { Authorization: `Basic ${creds}` },
      });
      expect(res2.status).toBe(200);
    });

    it('sets security headers', async () => {
      const svc = new SWMLService();
      svc.addVerb('answer', {});
      const app = svc.getApp();
      const res = await app.request('/', { method: 'GET' });
      expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
      expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    });
  });

  describe('onRequest callback', () => {
    it('uses callback builder instead of static builder', async () => {
      const svc = new SWMLService();
      // Static verbs — should be ignored when callback is set
      svc.addVerb('answer', {});

      svc.setOnRequestCallback((_query, _body, _headers) => {
        const b = new SwmlBuilder();
        b.addVerb('play', { url: 'say:Dynamic!' });
        b.addVerb('hangup', {});
        return b;
      });

      const app = svc.getApp();
      const res = await app.request('/', { method: 'GET' });
      const json = await res.json();
      const main = json['sections']['main'];
      expect(main).toHaveLength(2);
      expect(main[0]).toEqual({ play: { url: 'say:Dynamic!' } });
      expect(main[1]).toEqual({ hangup: {} });
    });

    it('receives query params from URL', async () => {
      let receivedQuery: Record<string, string> = {};
      const svc = new SWMLService();
      svc.setOnRequestCallback((query) => {
        receivedQuery = query;
        return new SwmlBuilder();
      });

      const app = svc.getApp();
      await app.request('/?action=voicemail&lang=en', { method: 'GET' });
      expect(receivedQuery['action']).toBe('voicemail');
      expect(receivedQuery['lang']).toBe('en');
    });

    it('receives body params from POST', async () => {
      let receivedBody: Record<string, unknown> = {};
      const svc = new SWMLService();
      svc.setOnRequestCallback((_query, body) => {
        receivedBody = body;
        return new SwmlBuilder();
      });

      const app = svc.getApp();
      await app.request('/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ foo: 'bar' }),
      });
      expect(receivedBody['foo']).toBe('bar');
    });

    it('supports async callbacks', async () => {
      const svc = new SWMLService();
      svc.setOnRequestCallback(async () => {
        await new Promise((r) => setTimeout(r, 10));
        const b = new SwmlBuilder();
        b.addVerb('answer', {});
        return b;
      });

      const app = svc.getApp();
      const res = await app.request('/', { method: 'GET' });
      const json = await res.json();
      expect(json['sections']['main']).toHaveLength(1);
    });
  });

  describe('run', () => {
    it('skips server startup in SWAIG_CLI_MODE', async () => {
      process.env['SWAIG_CLI_MODE'] = 'true';
      const svc = new SWMLService();
      // Should not throw or hang
      await svc.run();
      delete process.env['SWAIG_CLI_MODE'];
    });
  });
});
