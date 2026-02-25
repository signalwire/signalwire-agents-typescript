/**
 * ServerlessAdapter - Adapts AgentBase for serverless platforms.
 *
 * Supports AWS Lambda, Google Cloud Functions, Azure Functions, and CGI mode.
 * Auto-detects platform from environment variables.
 */

import { getLogger } from './Logger.js';

const log = getLogger('ServerlessAdapter');

/** Supported serverless platform identifiers, or 'auto' for environment-based detection. */
export type ServerlessPlatform = 'lambda' | 'gcf' | 'azure' | 'cgi' | 'auto';

/** Normalized incoming event from a serverless platform. */
export interface ServerlessEvent {
  /** HTTP method (AWS Lambda style). */
  httpMethod?: string;
  /** HTTP method (GCF/Azure style). */
  method?: string;
  /** Request headers as key-value pairs. */
  headers?: Record<string, string>;
  /** Request body, either raw JSON string or parsed object. */
  body?: string | Record<string, unknown>;
  /** Request path. */
  path?: string;
  /** Raw request path (AWS API Gateway v2). */
  rawPath?: string;
  /** Query string parameters as key-value pairs. */
  queryStringParameters?: Record<string, string>;
  /** Platform-specific request context metadata. */
  requestContext?: Record<string, unknown>;
}

/** Normalized outgoing response returned to a serverless platform. */
export interface ServerlessResponse {
  /** HTTP status code. */
  statusCode: number;
  /** Response headers as key-value pairs. */
  headers: Record<string, string>;
  /** Response body as a string. */
  body: string;
}

/** Adapts a Hono application for deployment on AWS Lambda, Google Cloud Functions, Azure Functions, or CGI. */
export class ServerlessAdapter {
  private platform: ServerlessPlatform;

  /**
   * Create a ServerlessAdapter for the given platform.
   * @param platform - Target platform; defaults to 'auto' which detects from environment variables.
   */
  constructor(platform: ServerlessPlatform = 'auto') {
    this.platform = platform === 'auto' ? this.detectPlatform() : platform;
  }

  /**
   * Detect the serverless platform by inspecting well-known environment variables.
   * @returns The detected platform identifier; defaults to 'lambda' if no match is found.
   */
  detectPlatform(): ServerlessPlatform {
    if (process.env['AWS_LAMBDA_FUNCTION_NAME'] || process.env['_HANDLER']) return 'lambda';
    if (process.env['FUNCTION_TARGET'] || process.env['K_SERVICE']) return 'gcf';
    if (process.env['FUNCTIONS_WORKER_RUNTIME'] || process.env['AZURE_FUNCTIONS_ENVIRONMENT']) return 'azure';
    if (process.env['GATEWAY_INTERFACE']) return 'cgi';
    return 'lambda'; // default fallback
  }

  /**
   * Get the resolved platform identifier.
   * @returns The serverless platform this adapter is configured for.
   */
  getPlatform(): ServerlessPlatform {
    return this.platform;
  }

  /**
   * Convert a serverless event into a standard Request, route it through the Hono app, and return a normalized response.
   * @param app - A Hono-compatible application with a `fetch` method.
   * @param event - The incoming serverless event to process.
   * @returns The normalized serverless response.
   */
  async handleRequest(app: { fetch: (req: Request) => Promise<Response> }, event: ServerlessEvent): Promise<ServerlessResponse> {
    const method = event.httpMethod ?? event.method ?? 'POST';
    const path = event.rawPath ?? event.path ?? '/';
    const headers = event.headers ?? {};

    // Build URL — prefer platform env vars over client headers
    const host = process.env['AWS_LAMBDA_FUNCTION_URL']
      ? new URL(process.env['AWS_LAMBDA_FUNCTION_URL']).hostname
      : (headers['host'] ?? 'localhost');
    const proto = process.env['AWS_LAMBDA_FUNCTION_URL'] ? 'https'
      : (headers['x-forwarded-proto'] ?? 'https');
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
   * Generate the platform-specific invocation URL for a deployed function.
   * @param opts - Optional overrides for region, project, function name, stage, or API ID.
   * @returns The constructed URL string.
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
   * Create an AWS Lambda-compatible handler function from a Hono app.
   * @param app - A Hono-compatible application with a `fetch` method.
   * @returns A function that accepts a Lambda event and returns a promise of a serverless response.
   */
  static createLambdaHandler(app: { fetch: (req: Request) => Promise<Response> }): (event: ServerlessEvent) => Promise<ServerlessResponse> {
    const adapter = new ServerlessAdapter('lambda');
    return (event: ServerlessEvent) => adapter.handleRequest(app, event);
  }

  /**
   * Create a Google Cloud Functions-compatible handler from a Hono app.
   * @param app - A Hono-compatible application with a `fetch` method.
   * @returns A function that accepts GCF request/response objects.
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
   * Create an Azure Functions-compatible handler from a Hono app.
   * @param app - A Hono-compatible application with a `fetch` method.
   * @returns A function that accepts an Azure context and request object.
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
