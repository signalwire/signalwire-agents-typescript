/**
 * Addresses namespace — list, create, get, delete (no update).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/** Address management (no update endpoint). */
export class AddressesResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/addresses');
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  async get(addressId: string): Promise<any> {
    return this._http.get(this._path(addressId));
  }

  async delete(addressId: string): Promise<any> {
    return this._http.delete(this._path(addressId));
  }
}
