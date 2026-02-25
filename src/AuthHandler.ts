/**
 * AuthHandler - Multi-method authentication handler.
 *
 * Supports Bearer token, API key, and Basic auth with constant-time comparison.
 * Can be used as Hono middleware or standalone validator.
 */

import { timingSafeEqual, randomBytes } from 'node:crypto';

export interface AuthConfig {
  /** Bearer token for Authorization: Bearer <token> */
  bearerToken?: string;
  /** API key for X-Api-Key header */
  apiKey?: string;
  /** Basic auth credentials [username, password] */
  basicAuth?: [string, string];
  /** Custom auth validator (return true to allow) */
  customValidator?: (request: { headers: Record<string, string>; method: string; url: string }) => boolean | Promise<boolean>;
}

/**
 * Constant-time string comparison to prevent timing attacks.
 */
function safeCompare(a: string, b: string): boolean {
  if (a.length !== b.length) {
    // Compare against a dummy to prevent length-based timing leaks
    const dummy = randomBytes(a.length).toString('hex');
    timingSafeEqual(Buffer.from(dummy), Buffer.from(dummy));
    return false;
  }
  return timingSafeEqual(Buffer.from(a), Buffer.from(b));
}

export class AuthHandler {
  private config: AuthConfig;

  constructor(config: AuthConfig) {
    this.config = config;
  }

  /**
   * Validate a request against configured auth methods.
   * Checks in order: Bearer > API Key > Basic > Custom.
   * Returns true if any method passes.
   */
  async validate(headers: Record<string, string>): Promise<boolean> {
    // 1. Bearer token
    if (this.config.bearerToken) {
      const authHeader = headers['authorization'] || headers['Authorization'] || '';
      if (authHeader.startsWith('Bearer ')) {
        const token = authHeader.slice(7);
        if (safeCompare(token, this.config.bearerToken)) return true;
      }
    }

    // 2. API Key
    if (this.config.apiKey) {
      const key = headers['x-api-key'] || headers['X-Api-Key'] || '';
      if (key && safeCompare(key, this.config.apiKey)) return true;
    }

    // 3. Basic auth
    if (this.config.basicAuth) {
      const authHeader = headers['authorization'] || headers['Authorization'] || '';
      if (authHeader.startsWith('Basic ')) {
        const decoded = Buffer.from(authHeader.slice(6), 'base64').toString();
        const colonIdx = decoded.indexOf(':');
        if (colonIdx > 0) {
          const user = decoded.slice(0, colonIdx);
          const pass = decoded.slice(colonIdx + 1);
          const [expectedUser, expectedPass] = this.config.basicAuth;
          if (safeCompare(user, expectedUser) && safeCompare(pass, expectedPass)) return true;
        }
      }
    }

    // 4. Custom validator
    if (this.config.customValidator) {
      const result = await this.config.customValidator({
        headers,
        method: '',
        url: '',
      });
      if (result) return true;
    }

    // If no methods configured, allow (backwards compat)
    if (!this.config.bearerToken && !this.config.apiKey && !this.config.basicAuth && !this.config.customValidator) {
      return true;
    }

    return false;
  }

  /**
   * Create Hono-compatible middleware function.
   */
  middleware(): (c: any, next: () => Promise<void>) => Promise<Response | void> {
    return async (c: any, next: () => Promise<void>) => {
      const headers: Record<string, string> = {};
      c.req.raw.headers.forEach((v: string, k: string) => { headers[k] = v; });

      const valid = await this.validate(headers);
      if (!valid) {
        return c.json({ error: 'Unauthorized' }, 401);
      }
      await next();
    };
  }

  /** Check if Bearer token auth is configured */
  hasBearerAuth(): boolean {
    return !!this.config.bearerToken;
  }

  /** Check if API key auth is configured */
  hasApiKeyAuth(): boolean {
    return !!this.config.apiKey;
  }

  /** Check if Basic auth is configured */
  hasBasicAuth(): boolean {
    return !!this.config.basicAuth;
  }
}
