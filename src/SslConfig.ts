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

/** Configuration options for SSL/TLS setup. */
export interface SslOptions {
  /** Whether SSL is enabled. */
  enabled?: boolean;
  /** Filesystem path to the PEM-encoded certificate. */
  certPath?: string;
  /** Filesystem path to the PEM-encoded private key. */
  keyPath?: string;
  /** Domain name used for HSTS headers. */
  domain?: string;
  /** Whether to send HSTS headers; defaults to true. */
  hsts?: boolean;
  /** HSTS max-age in seconds; defaults to 31536000 (1 year). */
  hstsMaxAge?: number;
}

/** Manages SSL/TLS configuration sourced from explicit options or environment variables. */
export class SslConfig {
  /** Whether SSL is enabled. */
  enabled: boolean;
  /** Filesystem path to the PEM certificate, or null if unset. */
  certPath: string | null;
  /** Filesystem path to the PEM private key, or null if unset. */
  keyPath: string | null;
  /** Domain name for HSTS, or null if unset. */
  domain: string | null;
  /** Whether HSTS headers should be emitted. */
  hsts: boolean;
  /** HSTS max-age value in seconds. */
  hstsMaxAge: number;

  /**
   * Create an SslConfig, falling back to environment variables for any unset options.
   * @param opts - Optional SSL configuration overrides.
   */
  constructor(opts?: SslOptions) {
    this.enabled = opts?.enabled ?? (process.env['SWML_SSL_ENABLED'] === 'true');
    this.certPath = opts?.certPath ?? process.env['SWML_SSL_CERT_PATH'] ?? null;
    this.keyPath = opts?.keyPath ?? process.env['SWML_SSL_KEY_PATH'] ?? null;
    this.domain = opts?.domain ?? process.env['SWML_SSL_DOMAIN'] ?? null;
    this.hsts = opts?.hsts ?? true;
    this.hstsMaxAge = opts?.hstsMaxAge ?? 31536000; // 1 year
  }

  /**
   * Check whether SSL is fully configured: enabled with both cert and key files present on disk.
   * @returns True if SSL is enabled and both certificate and key files exist.
   */
  isConfigured(): boolean {
    if (!this.enabled) return false;
    if (!this.certPath || !this.keyPath) return false;
    return existsSync(this.certPath) && existsSync(this.keyPath);
  }

  /**
   * Read the PEM certificate file from disk.
   * @returns The certificate contents, or null if the file is missing.
   */
  getCert(): string | null {
    if (!this.certPath || !existsSync(this.certPath)) return null;
    return readFileSync(this.certPath, 'utf-8');
  }

  /**
   * Read the PEM private key file from disk.
   * @returns The key contents, or null if the file is missing.
   */
  getKey(): string | null {
    if (!this.keyPath || !existsSync(this.keyPath)) return null;
    return readFileSync(this.keyPath, 'utf-8');
  }

  /**
   * Build the Strict-Transport-Security header value.
   * @returns The HSTS header string, or null if HSTS is disabled or SSL is off.
   */
  getHstsHeader(): string | null {
    if (!this.hsts || !this.enabled) return null;
    return `max-age=${this.hstsMaxAge}; includeSubDomains`;
  }

  /**
   * Create the options object needed by Node.js `https.createServer()`.
   * @returns An object with `cert` and `key` strings, or null if either file is missing.
   */
  getServerOptions(): { cert: string; key: string } | null {
    const cert = this.getCert();
    const key = this.getKey();
    if (!cert || !key) return null;
    return { cert, key };
  }

  /**
   * Return a Hono middleware that appends the HSTS header to every response.
   * @returns A Hono-compatible middleware function.
   */
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
