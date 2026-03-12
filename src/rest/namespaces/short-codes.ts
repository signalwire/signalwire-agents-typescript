/**
 * Short Codes namespace — list, get, update (no create/delete).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/** Short code management (read + update only). */
export class ShortCodesResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/short_codes');
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(shortCodeId: string): Promise<any> {
    return this._http.get(this._path(shortCodeId));
  }

  async update(shortCodeId: string, body: any): Promise<any> {
    return this._http.put(this._path(shortCodeId), body);
  }
}
