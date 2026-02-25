/**
 * SessionManager - Stateless HMAC-SHA256 token generation and validation.
 *
 * Tokens encode call_id, function name, expiry and a nonce, signed with a
 * shared secret. No server-side state is stored.
 */

import { randomBytes, createHmac } from 'node:crypto';

/** Stateless HMAC-SHA256 token manager for SWAIG function call authentication and per-session metadata storage. */
export class SessionManager {
  /** Token validity duration in seconds. */
  tokenExpirySecs: number;
  private secretKey: string;
  private sessionMetadata: Map<string, Record<string, unknown>> = new Map();

  /**
   * Create a new SessionManager.
   * @param tokenExpirySecs - Token validity duration in seconds (default 3600).
   * @param secretKey - HMAC signing secret; a random key is generated if omitted.
   */
  constructor(tokenExpirySecs = 3600, secretKey?: string) {
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
    const nonce = randomBytes(4).toString('hex');
    const message = `${callId}:${functionName}:${expiry}:${nonce}`;
    const signature = createHmac('sha256', this.secretKey)
      .update(message)
      .digest('hex')
      .slice(0, 16);
    const token = `${callId}.${functionName}.${expiry}.${nonce}.${signature}`;
    return Buffer.from(token).toString('base64url');
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
      if (parts.length !== 5) return false;
      const [tokenCallId, tokenFunction, tokenExpiry, tokenNonce, tokenSignature] = parts;

      const effectiveCallId = callId || tokenCallId;
      if (tokenFunction !== functionName) return false;

      const expiry = parseInt(tokenExpiry, 10);
      if (expiry < Date.now() / 1000) return false;

      const message = `${tokenCallId}:${tokenFunction}:${tokenExpiry}:${tokenNonce}`;
      const expectedSig = createHmac('sha256', this.secretKey)
        .update(message)
        .digest('hex')
        .slice(0, 16);
      if (tokenSignature !== expectedSig) return false;
      if (tokenCallId !== effectiveCallId) return false;

      return true;
    } catch {
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
