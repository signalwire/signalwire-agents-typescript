/**
 * AgentServer - Hosts multiple AgentBase instances under a single HTTP server.
 *
 * Each agent is mounted at its own route prefix. The root `/` lists all
 * registered agents, and `/health` + `/ready` are global health checks.
 */

import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { AgentBase } from './AgentBase.js';
import { getLogger } from './Logger.js';

/** Multi-agent HTTP server that hosts multiple AgentBase instances on distinct route prefixes. */
export class AgentServer {
  /** Hostname the server binds to. */
  host: string;
  /** Port the server listens on. */
  port: number;
  private agents: Map<string, AgentBase> = new Map();
  private _app: Hono;
  private log = getLogger('AgentServer');

  /**
   * Create an AgentServer.
   * @param opts - Optional host and port overrides; defaults to 0.0.0.0:3000.
   */
  constructor(opts?: { host?: string; port?: number }) {
    this.host = opts?.host ?? '0.0.0.0';
    this.port = opts?.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
    this._app = new Hono();

    // Security headers
    this._app.use('*', async (c, next) => {
      await next();
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });

    // CORS (configurable via env)
    const corsOrigins = process.env['SWML_CORS_ORIGINS'];
    const corsOrigin = corsOrigins ? corsOrigins.split(',').map((o: string) => o.trim()) : '*';
    const corsCredentials = corsOrigin !== '*';
    this._app.use('*', cors({ origin: corsOrigin, credentials: corsCredentials }));

    // Global health endpoints
    this._app.get('/health', (c) => c.json({ status: 'ok' }));
    this._app.get('/ready', (c) => c.json({ status: 'ready' }));
  }

  /**
   * Register an agent at the given route prefix.
   * @param agent - The AgentBase instance to mount.
   * @param route - Route prefix; defaults to the agent's own route or '/'.
   * @throws If the route is already occupied by another agent.
   */
  register(agent: AgentBase, route?: string): void {
    let r = route ?? (agent as any).route ?? '/';
    if (!r.startsWith('/')) r = `/${r}`;
    r = r.replace(/\/+$/, '') || '/';

    if (this.agents.has(r)) {
      throw new Error(`Route '${r}' is already in use`);
    }

    this.agents.set(r, agent);

    // Mount the agent's Hono app at the route prefix
    const agentApp = agent.getApp();
    if (r === '/') {
      this._app.route('/', agentApp);
    } else {
      this._app.route(r, agentApp);
    }

    this.log.info(`Registered '${agent.name}' at ${r}`);
  }

  /**
   * Remove an agent registration by route.
   * @param route - The route prefix to unregister.
   */
  unregister(route: string): void {
    this.agents.delete(route);
    // Note: Hono doesn't support dynamic route removal,
    // but the agent won't be listed anymore
  }

  /**
   * Get all registered agents keyed by their route prefix.
   * @returns A map of route prefixes to AgentBase instances.
   */
  getAgents(): Map<string, AgentBase> {
    return this.agents;
  }

  /**
   * Look up a registered agent by its route prefix.
   * @param route - The route prefix to look up.
   * @returns The agent at that route, or undefined if none is registered.
   */
  getAgent(route: string): AgentBase | undefined {
    return this.agents.get(route);
  }

  /**
   * Build and return the Hono application with all registered agents and a root listing endpoint.
   * @returns The fully configured Hono app.
   */
  getApp(): Hono {
    // Add root listing (registered after agents so it doesn't shadow them)
    const listing = [...this.agents.entries()].map(([route, agent]) => ({
      name: agent.name,
      route,
    }));

    // We create a response for the root that lists agents
    // Only if no agent is mounted at /
    if (!this.agents.has('/')) {
      this._app.get('/', (c) =>
        c.json({
          service: 'SignalWire AI Agents',
          agents: listing,
        }),
      );
    }

    return this._app;
  }

  /**
   * Start the HTTP server and begin listening for requests.
   * @param host - Override the configured hostname.
   * @param port - Override the configured port.
   */
  async run(host?: string, port?: number): Promise<void> {
    // When loaded by the CLI tool, skip server startup — only the agent config is needed.
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const { serve } = await import('@hono/node-server');
    const h = host ?? this.host;
    const p = port ?? this.port;

    const app = this.getApp();

    if (this.agents.size === 0) {
      this.log.warn('starting_server_with_no_agents');
    }

    this.log.info(`Starting on http://${h}:${p}`);
    for (const [route, agent] of this.agents) {
      const [user] = agent.getBasicAuthCredentials();
      this.log.info(`  ${route} -> ${agent.name} (auth: ${user}:****)`);
    }

    serve({ fetch: app.fetch, port: p, hostname: h });
  }
}
