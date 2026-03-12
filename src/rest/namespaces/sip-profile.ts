/**
 * SIP Profile namespace — get and update project SIP profile.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/** Project SIP profile (singleton resource). */
export class SipProfileResource extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/sip_profile');
  }

  /** Get the SIP profile. */
  async get(): Promise<any> {
    return this._http.get(this._basePath);
  }

  /** Update the SIP profile. */
  async update(body: any): Promise<any> {
    return this._http.put(this._basePath, body);
  }
}
