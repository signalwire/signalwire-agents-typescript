/**
 * Chat API namespace — token creation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/** Chat token generation. */
export class ChatResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/chat/tokens');
  }

  /** Generate a Chat token. */
  async createToken(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}
