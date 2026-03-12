/**
 * Queues namespace — CRUD + member management.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/** Queue management with member operations. */
export class QueuesResource extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient) {
    super(http, '/api/relay/rest/queues');
  }

  /** List members in a queue. */
  async listMembers(queueId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(queueId, 'members'), params);
  }

  /** Get the next member in a queue. */
  async getNextMember(queueId: string): Promise<any> {
    return this._http.get(this._path(queueId, 'members', 'next'));
  }

  /** Get a specific member in a queue. */
  async getMember(queueId: string, memberId: string): Promise<any> {
    return this._http.get(this._path(queueId, 'members', memberId));
  }
}
