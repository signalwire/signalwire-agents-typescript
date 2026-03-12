/**
 * CrudResource extended with address listing.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from './CrudResource.js';

export class CrudWithAddresses<
  TList = any,
  TItem = any,
  TCreate = any,
  TUpdate = any,
> extends CrudResource<TList, TItem, TCreate, TUpdate> {

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  /** List addresses associated with a resource. */
  async listAddresses(resourceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(resourceId, 'addresses'), params);
  }
}
