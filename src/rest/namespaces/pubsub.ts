/**
 * PubSub API namespace — token creation.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/** PubSub token generation. */
export class PubSubResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/pubsub/tokens');
  }

  /** Generate a PubSub token. */
  async createToken(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}
