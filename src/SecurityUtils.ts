/**
 * SecurityUtils - Shared security utility functions.
 *
 * Provides prototype pollution protection, SSRF guards, header filtering,
 * URL credential redaction, hostname validation, and input length limits.
 */

import { lookup } from 'node:dns/promises';

/** Maximum allowed input length for skill handler arguments (characters). */
export const MAX_SKILL_INPUT_LENGTH = 1000;

/** Keys that must never be copied via object spread or assign. */
const DANGEROUS_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

/**
 * Copy properties from `source` to `target`, filtering out prototype-pollution keys.
 * Drop-in replacement for `Object.assign(target, source)` where `source` is untrusted.
 * @param target - The object to assign into.
 * @param source - The object to copy properties from.
 * @returns The target object.
 */
export function safeAssign<T extends Record<string, unknown>>(target: T, source: Record<string, unknown>): T {
  for (const key of Object.keys(source)) {
    if (!DANGEROUS_KEYS.has(key)) {
      (target as Record<string, unknown>)[key] = source[key];
    }
  }
  return target;
}

/** Headers that must be stripped before passing to user callbacks. */
const SENSITIVE_HEADERS = new Set([
  'authorization',
  'cookie',
  'x-api-key',
  'proxy-authorization',
  'set-cookie',
]);

/**
 * Return a copy of `headers` with sensitive entries (authorization, cookie, etc.) removed.
 * @param headers - Original header record.
 * @returns A new record with sensitive headers removed.
 */
export function filterSensitiveHeaders(headers: Record<string, string>): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [k, v] of Object.entries(headers)) {
    if (!SENSITIVE_HEADERS.has(k.toLowerCase())) {
      result[k] = v;
    }
  }
  return result;
}

/**
 * Redact credentials embedded in a URL (e.g. `https://user:secret@host` -> `https://user:****@host`).
 * Returns the URL unchanged if no credentials are present.
 * @param url - The URL string to redact.
 * @returns The URL with the password portion replaced by `****`.
 */
export function redactUrl(url: string): string {
  return url.replace(/:\/\/([^:@]+):([^@]+)@/, '://$1:****@');
}

/**
 * Validate that a hostname string does not contain whitespace, slashes, or control characters.
 * @param host - Hostname to validate.
 * @returns True if the hostname is valid.
 */
export function isValidHostname(host: string): boolean {
  if (!host || host.length === 0) return false;
  // Reject whitespace, slashes, control chars
  return !/[\s/\\]/.test(host) && !/[\x00-\x1f\x7f]/.test(host);
}

/**
 * Check whether an IP address belongs to a private/reserved range.
 * Covers RFC1918, loopback, link-local, IPv6 private (fc/fd, ::1, fe80).
 * @param ip - The IP address string to check.
 * @returns True if the IP is private/reserved.
 */
export function isPrivateIp(ip: string): boolean {
  // IPv4
  if (/^127\./.test(ip)) return true;
  if (/^10\./.test(ip)) return true;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(ip)) return true;
  if (/^192\.168\./.test(ip)) return true;
  if (/^169\.254\./.test(ip)) return true;
  if (ip === '0.0.0.0') return true;

  // IPv6
  if (ip === '::1') return true;
  if (/^f[cd]/i.test(ip)) return true;
  if (/^fe80/i.test(ip)) return true;

  return false;
}

/**
 * DNS-resolve a URL's hostname and reject it if it points to a private IP.
 * @param url - The full URL to validate.
 * @param allowPrivate - When true, skip the private-IP check (default false).
 * @throws If the resolved IP is private and `allowPrivate` is false.
 */
export async function resolveAndValidateUrl(url: string, allowPrivate = false): Promise<void> {
  if (allowPrivate) return;

  let hostname: string;
  try {
    hostname = new URL(url).hostname;
  } catch {
    throw new Error(`Invalid URL: ${url}`);
  }

  // Direct IP check first
  if (isPrivateIp(hostname)) {
    throw new Error(`URL resolves to a private IP address: ${hostname}`);
  }

  // DNS resolution
  try {
    const result = await lookup(hostname);
    if (isPrivateIp(result.address)) {
      throw new Error(`URL hostname '${hostname}' resolves to private IP: ${result.address}`);
    }
  } catch (err) {
    // Re-throw our own errors; DNS failures are allowed (host may not resolve in test)
    if (err instanceof Error && err.message.includes('private IP')) {
      throw err;
    }
    // DNS lookup failure - let the actual HTTP request handle it
  }
}
