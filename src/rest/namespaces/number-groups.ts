/**
 * Number Groups namespace — CRUD + membership management.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/** Number group management with membership operations. */
export class NumberGroupsResource extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/number_groups');
  }

  /** List memberships for a group. */
  async listMemberships(groupId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(groupId, 'number_group_memberships'), params);
  }

  /** Add a number to a group. */
  async addMembership(groupId: string, body: any): Promise<any> {
    return this._http.post(this._path(groupId, 'number_group_memberships'), body);
  }

  /** Get a membership by ID. */
  async getMembership(membershipId: string): Promise<any> {
    return this._http.get(`/api/relay/rest/number_group_memberships/${membershipId}`);
  }

  /** Delete a membership by ID. */
  async deleteMembership(membershipId: string): Promise<any> {
    return this._http.delete(`/api/relay/rest/number_group_memberships/${membershipId}`);
  }
}
