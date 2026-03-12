/**
 * Project API namespace — API token management.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/** Project API token management. */
export class ProjectTokens extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/project/tokens');
  }

  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  async update(tokenId: string, body: any): Promise<any> {
    return this._http.patch(this._path(tokenId), body);
  }

  async delete(tokenId: string): Promise<any> {
    return this._http.delete(this._path(tokenId));
  }
}

/** Project API namespace. */
export class ProjectNamespace {
  readonly tokens: ProjectTokens;

  constructor(http: HttpClient) {
    this.tokens = new ProjectTokens(http);
  }
}
