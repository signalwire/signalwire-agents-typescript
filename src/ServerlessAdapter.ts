/**
 * ServerlessAdapter - Adapts AgentBase for serverless platforms.
 *
 * Supports AWS Lambda, Google Cloud Functions, Azure Functions, and CGI mode.
 * Auto-detects platform from environment variables.
 */

import { getLogger } from './Logger.js';

const log = getLogger('ServerlessAdapter');

export type ServerlessPlatform = 'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto';

export interface ServerlessEvent {
  httpMethod?: string;
  method?: string;
  headers?: Record<string, string>;
  body?: string | Record<string, unknown>;
  path?: string;
  rawPath?: string;
  queryStringParameters?: Record<string, string>;
  requestContext?: Record<string, unknown>;
}

export interface ServerlessResponse {
  statusCode: number;
  headers: Record<string, string>;
  body: string;
}

export class ServerlessAdapter {
  private platform: ServerlessPlatform;

  constructor(platform: ServerlessPlatform = 'auto') {
    this.platform = platform === 'auto' ? this.detectPlatform() : platform;
  }

  /** Detect the serverless platform from environment */
  detectPlatform(): ServerlessPlatform {
    if (process.env['AWS_LAMBDA_FUNCTION_NAME'] || process.env['_HANDLER']) return 'lambda';
    if (process.env['FUNCTION_TARGET'] || process.env['K_SERVICE']) return 'gcf';
    if (process.env['FUNCTIONS_WORKER_RUNTIME'] || process.env['AZURE_FUNCTIONS_ENVIRONMENT']) return 'azure';
    if (process.env['GATEWAY_INTERFACE']) return 'cgi';
    return 'lambda'; // default fallback
  }

  /** Get the detected platform */
  getPlatform(): ServerlessPlatform {
    return this.platform;
  }

  /**
   * Handle a serverless request by routing it through a Hono app.
   */
  async handleRequest(app: { fetch: (req: Request) => Promise<Response> }, event: ServerlessEvent): Promise<ServerlessResponse> {
    const method = event.httpMethod ?? event.method ?? 'POST';
    const path = event.rawPath ?? event.path ?? '/';
    const headers = event.headers ?? {};

    // Build URL
    const host = headers['host'] ?? 'localhost';
    const proto = headers['x-forwarded-proto'] ?? 'https';
    let url = `${proto}://${host}${path}`;
    if (event.queryStringParameters) {
      const qs = new URLSearchParams(event.queryStringParameters).toString();
      if (qs) url += `?${qs}`;
    }

    // Build body
    let body: string | undefined;
    if (event.body) {
      body = typeof event.body === 'string' ? event.body : JSON.stringify(event.body);
    }

    // Create Request
    const request = new Request(url, {
      method,
      headers: new Headers(headers),
      body: method !== 'GET' && method !== 'HEAD' ? body : undefined,
    });

    log.debug(`Handling ${method} ${path} on ${this.platform}`);

    // Route through Hono
    const response = await app.fetch(request);

    // Convert back to serverless response
    const responseHeaders: Record<string, string> = {};
    response.headers.forEach((v, k) => { responseHeaders[k] = v; });

    return {
      statusCode: response.status,
      headers: responseHeaders,
      body: await response.text(),
    };
  }

  /**
   * Generate the platform-specific URL for a deployed function.
   */
  generateUrl(opts?: {
    region?: string;
    projectId?: string;
    functionName?: string;
    stage?: string;
    apiId?: string;
  }): string {
    const functionName = opts?.functionName ?? process.env['AWS_LAMBDA_FUNCTION_NAME'] ?? 'agent';

    switch (this.platform) {
      case 'lambda': {
        const region = opts?.region ?? process.env['AWS_REGION'] ?? 'us-east-1';
        const apiId = opts?.apiId ?? 'API_ID';
        const stage = opts?.stage ?? 'prod';
        return `https://${apiId}.execute-api.${region}.amazonaws.com/${stage}`;
      }
      case 'gcf': {
        const project = opts?.projectId ?? process.env['GCLOUD_PROJECT'] ?? 'PROJECT';
        const region = opts?.region ?? process.env['FUNCTION_REGION'] ?? 'us-central1';
        return `https://${region}-${project}.cloudfunctions.net/${functionName}`;
      }
      case 'azure': {
        return `https://${functionName}.azurewebsites.net/api/${functionName}`;
      }
      case 'cgi': {
        return `http://localhost/cgi-bin/${functionName}`;
      }
      default:
        return `https://localhost/${functionName}`;
    }
  }

  /**
   * Create a Lambda-style handler function.
   */
  static createLambdaHandler(app: { fetch: (req: Request) => Promise<Response> }): (event: ServerlessEvent) => Promise<ServerlessResponse> {
    const adapter = new ServerlessAdapter('lambda');
    return (event: ServerlessEvent) => adapter.handleRequest(app, event);
  }

  /**
   * Create a GCF-style handler function.
   */
  static createGcfHandler(app: { fetch: (req: Request) => Promise<Response> }): (req: any, res: any) => Promise<void> {
    const adapter = new ServerlessAdapter('gcf');
    return async (req: any, res: any) => {
      const event: ServerlessEvent = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        path: req.path ?? req.url,
      };
      const response = await adapter.handleRequest(app, event);
      res.status(response.statusCode);
      for (const [k, v] of Object.entries(response.headers)) {
        res.set(k, v);
      }
      res.send(response.body);
    };
  }

  /**
   * Create an Azure Functions-style handler.
   */
  static createAzureHandler(app: { fetch: (req: Request) => Promise<Response> }): (context: any, req: any) => Promise<void> {
    const adapter = new ServerlessAdapter('azure');
    return async (context: any, req: any) => {
      const event: ServerlessEvent = {
        method: req.method,
        headers: req.headers,
        body: req.body,
        path: req.url,
      };
      const response = await adapter.handleRequest(app, event);
      context.res = {
        status: response.statusCode,
        headers: response.headers,
        body: response.body,
      };
    };
  }
}
