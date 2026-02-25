/**
 * SslConfig - SSL/TLS configuration for HTTPS serving.
 *
 * Env vars:
 *   SWML_SSL_ENABLED: true|false
 *   SWML_SSL_CERT_PATH: path to PEM cert
 *   SWML_SSL_KEY_PATH: path to PEM key
 *   SWML_SSL_DOMAIN: domain for HSTS
 */

import { readFileSync, existsSync } from 'node:fs';

export interface SslOptions {
  enabled?: boolean;
  certPath?: string;
  keyPath?: string;
  domain?: string;
  hsts?: boolean;
  hstsMaxAge?: number;
}

export class SslConfig {
  enabled: boolean;
  certPath: string | null;
  keyPath: string | null;
  domain: string | null;
  hsts: boolean;
  hstsMaxAge: number;

  constructor(opts?: SslOptions) {
    this.enabled = opts?.enabled ?? (process.env['SWML_SSL_ENABLED'] === 'true');
    this.certPath = opts?.certPath ?? process.env['SWML_SSL_CERT_PATH'] ?? null;
    this.keyPath = opts?.keyPath ?? process.env['SWML_SSL_KEY_PATH'] ?? null;
    this.domain = opts?.domain ?? process.env['SWML_SSL_DOMAIN'] ?? null;
    this.hsts = opts?.hsts ?? true;
    this.hstsMaxAge = opts?.hstsMaxAge ?? 31536000; // 1 year
  }

  /** Check if SSL is fully configured (enabled + both cert and key exist) */
  isConfigured(): boolean {
    if (!this.enabled) return false;
    if (!this.certPath || !this.keyPath) return false;
    return existsSync(this.certPath) && existsSync(this.keyPath);
  }

  /** Read the certificate file */
  getCert(): string | null {
    if (!this.certPath || !existsSync(this.certPath)) return null;
    return readFileSync(this.certPath, 'utf-8');
  }

  /** Read the key file */
  getKey(): string | null {
    if (!this.keyPath || !existsSync(this.keyPath)) return null;
    return readFileSync(this.keyPath, 'utf-8');
  }

  /** Get HSTS header value */
  getHstsHeader(): string | null {
    if (!this.hsts || !this.enabled) return null;
    return `max-age=${this.hstsMaxAge}; includeSubDomains`;
  }

  /** Create Node.js HTTPS server options */
  getServerOptions(): { cert: string; key: string } | null {
    const cert = this.getCert();
    const key = this.getKey();
    if (!cert || !key) return null;
    return { cert, key };
  }

  /** Hono middleware to add HSTS header */
  hstsMiddleware(): (c: any, next: () => Promise<void>) => Promise<void> {
    return async (c: any, next: () => Promise<void>) => {
      await next();
      const hsts = this.getHstsHeader();
      if (hsts) {
        c.res.headers.set('Strict-Transport-Security', hsts);
      }
    };
  }
}
