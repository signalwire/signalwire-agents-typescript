/**
 * Phone Number Lookup namespace.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/** Phone number lookup (carrier, CNAM). */
export class LookupResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/lookup');
  }

  /** Look up carrier/CNAM info for a phone number. */
  async phoneNumber(e164: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path('phone_number', e164), params);
  }
}
