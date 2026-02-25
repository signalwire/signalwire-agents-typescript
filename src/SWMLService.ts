/**
 * SWMLService - Lightweight HTTP service for non-AI SWML documents.
 *
 * Unlike AgentBase (which always produces an AI block), SWMLService generates
 * pure SWML call-flow documents: IVR menus, voicemail, call recording, etc.
 * Uses SwmlBuilder for verb methods and Hono for HTTP serving.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { basicAuth } from 'hono/basic-auth';
import { SwmlBuilder } from './SwmlBuilder.js';
import { getLogger } from './Logger.js';

/** Callback invoked per-request to dynamically build SWML. */
export type OnRequestCallback = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
) => SwmlBuilder | Promise<SwmlBuilder>;

/** Configuration options for SWMLService. */
export interface SWMLServiceOptions {
  /** Service display name. */
  name?: string;
  /** HTTP route path (default '/'). */
  route?: string;
  /** Basic auth credentials as [username, password]. */
  basicAuth?: [string, string];
}

/** HTTP service that serves non-AI SWML documents built from verb methods. */
export class SWMLService {
  /** Service display name. */
  readonly name: string;
  /** HTTP route path. */
  readonly route: string;

  private swmlBuilder: SwmlBuilder;
  private _app: Hono;
  private onRequestCallback?: OnRequestCallback;
  private authCredentials?: [string, string];
  private log = getLogger('SWMLService');

  constructor(opts?: SWMLServiceOptions) {
    this.name = opts?.name ?? 'swml-service';
    this.route = opts?.route ?? '/';
    this.authCredentials = opts?.basicAuth;
    this.swmlBuilder = new SwmlBuilder();
    this._app = new Hono();

    // Security headers
    this._app.use('*', async (c, next) => {
      await next();
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    });

    // CORS
    this._app.use('*', cors({ origin: '*', credentials: true }));

    // Basic auth
    if (this.authCredentials) {
      const [user, pass] = this.authCredentials;
      this._app.use('*', basicAuth({ username: user, password: pass }));
    }

    // Health endpoints
    this._app.get('/health', (c) => c.json({ status: 'ok' }));
    this._app.get('/ready', (c) => c.json({ status: 'ready' }));

    // Main SWML endpoint — serves on both GET and POST
    const handler = async (c: any) => {
      let doc: Record<string, unknown>;

      if (this.onRequestCallback) {
        const url = new URL(c.req.url);
        const queryParams: Record<string, string> = {};
        url.searchParams.forEach((v, k) => { queryParams[k] = v; });

        let bodyParams: Record<string, unknown> = {};
        if (c.req.method === 'POST') {
          try {
            bodyParams = await c.req.json();
          } catch {
            // empty body is fine
          }
        }

        const headers: Record<string, string> = {};
        c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });

        const builder = await this.onRequestCallback(queryParams, bodyParams, headers);
        doc = builder.getDocument();
      } else {
        doc = this.swmlBuilder.getDocument();
      }

      return c.json(doc);
    };

    const routePath = this.route === '/' ? '/' : this.route;
    this._app.get(routePath, handler);
    this._app.post(routePath, handler);
  }

  // ── SwmlBuilder delegation ────────────────────────────────────────

  /**
   * Get the underlying SwmlBuilder for direct manipulation.
   * @returns The SwmlBuilder instance.
   */
  getBuilder(): SwmlBuilder {
    return this.swmlBuilder;
  }

  /**
   * Add a verb to the SWML document.
   * @param name - Verb name (e.g., 'answer', 'play', 'hangup').
   * @param config - Verb configuration.
   * @returns This service for chaining.
   */
  addVerb(name: string, config: unknown): this {
    this.swmlBuilder.addVerb(name, config);
    return this;
  }

  /**
   * Render the SWML document as a JSON object.
   * @returns The SWML document.
   */
  renderSwml(): Record<string, unknown> {
    return this.swmlBuilder.getDocument();
  }

  // ── Dynamic request callback ──────────────────────────────────────

  /**
   * Set a callback invoked per-request to dynamically build SWML.
   * When set, the static SwmlBuilder is ignored and the callback's
   * returned SwmlBuilder is used instead.
   * @param cb - Callback receiving query params, body params, and headers.
   * @returns This service for chaining.
   */
  setOnRequestCallback(cb: OnRequestCallback): this {
    this.onRequestCallback = cb;
    return this;
  }

  // ── HTTP ──────────────────────────────────────────────────────────

  /**
   * Get the Hono application for mounting or testing.
   * @returns The configured Hono app.
   */
  getApp(): Hono {
    return this._app;
  }

  /**
   * Start the HTTP server.
   * @param host - Hostname (default '0.0.0.0').
   * @param port - Port (default 3000 or PORT env var).
   */
  async run(host?: string, port?: number): Promise<void> {
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const { serve } = await import('@hono/node-server');
    const h = host ?? '0.0.0.0';
    const p = port ?? parseInt(process.env['PORT'] ?? '3000', 10);

    this.log.info(`${this.name} starting on http://${h}:${p}${this.route}`);
    serve({ fetch: this._app.fetch, port: p, hostname: h });
  }
}
