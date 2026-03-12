/**
 * Phone Numbers namespace — list, search, purchase, get, update, release.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/** Phone number management. */
export class PhoneNumbersResource extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/phone_numbers');
  }

  /** Search available phone numbers for purchase. */
  async search(params?: QueryParams): Promise<any> {
    return this._http.get(this._path('search'), params);
  }
}
