/**
 * SessionManager - Stateless HMAC-SHA256 token generation and validation.
 *
 * Tokens encode call_id, function name, expiry and a nonce, signed with a
 * shared secret. No server-side state is stored.
 */

import { randomBytes, createHmac } from 'node:crypto';
import { getLogger } from './Logger.js';

/** Stateless HMAC-SHA256 token manager for SWAIG function call authentication and per-session metadata storage. */
export class SessionManager {
  /** Token validity duration in seconds. */
  tokenExpirySecs: number;
  private secretKey: string;
  private sessionMetadata: Map<string, Record<string, unknown>> = new Map();
  private sessionTimestamps: Map<string, number> = new Map();
  private log = getLogger('SessionManager');

  /**
   * Create a new SessionManager.
   * @param tokenExpirySecs - Token validity duration in seconds (default 900).
   * @param secretKey - HMAC signing secret; a random key is generated if omitted.
   */
  constructor(tokenExpirySecs = 900, secretKey?: string) {
    this.tokenExpirySecs = tokenExpirySecs;
    this.secretKey = secretKey ?? randomBytes(32).toString('hex');
  }

  /**
   * Return the given callId or generate a new random session identifier.
   * @param callId - Existing call ID to reuse.
   * @returns The call ID string.
   */
  createSession(callId?: string): string {
    if (callId) return callId;
    return randomBytes(16).toString('base64url');
  }

  /**
   * Generate a signed, base64url-encoded token binding a function name to a call ID.
   * @param functionName - The SWAIG function name to bind.
   * @param callId - The call ID to bind.
   * @returns A base64url-encoded token string.
   */
  generateToken(functionName: string, callId: string): string {
    const expiry = Math.floor(Date.now() / 1000) + this.tokenExpirySecs;
    const nonce = randomBytes(16).toString('hex');
    const message = `${callId}:${functionName}:${expiry}:${nonce}`;
    const signature = createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex');
    const token = `${callId}.${functionName}.${expiry}.${nonce}.${signature}`;
    const encoded = Buffer.from(token).toString('base64url');
    this.log.debug('created_token', { function: functionName, call_id: callId });
    return encoded;
  }

  /**
   * Alias for {@link generateToken}.
   * @param functionName - The SWAIG function name to bind.
   * @param callId - The call ID to bind.
   * @returns A base64url-encoded token string.
   */
  createToolToken(functionName: string, callId: string): string {
    return this.generateToken(functionName, callId);
  }

  /**
   * Validate a token against the expected call ID and function name.
   * @param callId - The expected call ID.
   * @param functionName - The expected function name.
   * @param token - The base64url-encoded token to validate.
   * @returns True if the token is valid and not expired.
   */
  validateToken(callId: string, functionName: string, token: string): boolean {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const parts = decoded.split('.');
      if (parts.length !== 5) {
        this.log.warn('token_invalid', { function: functionName });
        return false;
      }
      const [tokenCallId, tokenFunction, tokenExpiry, tokenNonce, tokenSignature] = parts;

      if (!callId) {
        this.log.warn('token_rejected_no_call_id', { function: functionName });
        return false;
      }
      if (tokenFunction !== functionName) {
        this.log.warn('token_function_mismatch', { expected: functionName, got: tokenFunction });
        return false;
      }

      const expiry = parseInt(tokenExpiry, 10);
      if (expiry <= Math.floor(Date.now() / 1000)) {
        this.log.warn('token_expired', { function: functionName });
        return false;
      }

      const message = `${tokenCallId}:${tokenFunction}:${tokenExpiry}:${tokenNonce}`;
      const expectedSig = createHmac('sha256', this.secretKey)
        .update(message)
        .digest('hex');
      if (tokenSignature !== expectedSig) {
        this.log.warn('token_invalid', { function: functionName });
        return false;
      }
      if (tokenCallId !== callId) {
        this.log.warn('token_call_id_mismatch', { expected: callId, got: tokenCallId });
        return false;
      }

      this.log.debug('token_valid', { function: functionName });
      return true;
    } catch {
      this.log.warn('token_invalid', { function: functionName });
      return false;
    }
  }

  /**
   * Alias for {@link validateToken} with reordered parameters.
   * @param functionName - The expected function name.
   * @param token - The base64url-encoded token to validate.
   * @param callId - The expected call ID.
   * @returns True if the token is valid and not expired.
   */
  validateToolToken(functionName: string, token: string, callId: string): boolean {
    return this.validateToken(callId, functionName, token);
  }

  /**
   * Decode token components for debugging without validating the signature.
   * @param token - The base64url-encoded token to decode.
   * @returns The decoded token fields and expiration status, or null if malformed.
   */
  debugToken(token: string): { callId: string; functionName: string; expiry: number; nonce: string; signature: string; expired: boolean } | null {
    try {
      const decoded = Buffer.from(token, 'base64url').toString();
      const parts = decoded.split('.');
      if (parts.length !== 5) return null;
      const [callId, functionName, expiryStr, nonce, signature] = parts;
      const expiry = parseInt(expiryStr, 10);
      return {
        callId,
        functionName,
        expiry,
        nonce,
        signature,
        expired: expiry < Date.now() / 1000,
      };
    } catch {
      return null;
    }
  }

  /**
   * Retrieve metadata associated with a session.
   * @param sessionId - The session identifier.
   * @returns The metadata record, or undefined if no metadata exists.
   */
  getSessionMetadata(sessionId: string): Record<string, unknown> | undefined {
    return this.sessionMetadata.get(sessionId);
  }

  /**
   * Merge metadata into a session, creating the entry if it does not exist.
   * @param sessionId - The session identifier.
   * @param metadata - Key-value pairs to merge into the session metadata.
   */
  setSessionMetadata(sessionId: string, metadata: Record<string, unknown>): void {
    this.sessionMetadata.set(sessionId, { ...this.sessionMetadata.get(sessionId), ...metadata });
    this.sessionTimestamps.set(sessionId, Date.now());
    // Auto-cleanup when map grows too large
    if (this.sessionMetadata.size > 1000) {
      this.cleanup();
    }
  }

  /**
   * Remove session metadata entries older than `maxAgeMs`.
   * @param maxAgeMs - Maximum age in milliseconds (defaults to `tokenExpirySecs * 1000`).
   */
  cleanup(maxAgeMs?: number): void {
    const maxAge = maxAgeMs ?? this.tokenExpirySecs * 1000;
    const cutoff = Date.now() - maxAge;
    for (const [id, ts] of this.sessionTimestamps) {
      if (ts <= cutoff) {
        this.sessionMetadata.delete(id);
        this.sessionTimestamps.delete(id);
      }
    }
  }

  /**
   * Delete all metadata for a session.
   * @param sessionId - The session identifier.
   * @returns True if the session existed and was deleted.
   */
  deleteSessionMetadata(sessionId: string): boolean {
    return this.sessionMetadata.delete(sessionId);
  }
}
