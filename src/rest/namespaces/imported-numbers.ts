/**
 * Imported Phone Numbers namespace — create only.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/** Import externally-hosted phone numbers. */
export class ImportedNumbersResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/imported_phone_numbers');
  }

  /** Import a phone number. */
  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}
