/**
 * Custom error class for REST API errors.
 */
export class RestError extends Error {
  readonly statusCode: number;
  readonly body: string;
  readonly url: string;
  readonly method: string;

  constructor(statusCode: number, body: string, url: string, method: string) {
    super(`${method} ${url} returned ${statusCode}: ${body}`);
    this.name = 'RestError';
    this.statusCode = statusCode;
    this.body = body;
    this.url = url;
    this.method = method;
  }
}
