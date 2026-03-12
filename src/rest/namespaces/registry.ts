/**
 * 10DLC Campaign Registry namespace — brands, campaigns, orders, numbers.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/** 10DLC brand management. */
export class RegistryBrands extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  async get(brandId: string): Promise<any> {
    return this._http.get(this._path(brandId));
  }

  async listCampaigns(brandId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(brandId, 'campaigns'), params);
  }

  async createCampaign(brandId: string, body: any): Promise<any> {
    return this._http.post(this._path(brandId, 'campaigns'), body);
  }
}

/** 10DLC campaign management. */
export class RegistryCampaigns extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async get(campaignId: string): Promise<any> {
    return this._http.get(this._path(campaignId));
  }

  async update(campaignId: string, body: any): Promise<any> {
    return this._http.put(this._path(campaignId), body);
  }

  async listNumbers(campaignId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(campaignId, 'numbers'), params);
  }

  async listOrders(campaignId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(campaignId, 'orders'), params);
  }

  async createOrder(campaignId: string, body: any): Promise<any> {
    return this._http.post(this._path(campaignId, 'orders'), body);
  }
}

/** 10DLC assignment order management. */
export class RegistryOrders extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async get(orderId: string): Promise<any> {
    return this._http.get(this._path(orderId));
  }
}

/** 10DLC number assignment management. */
export class RegistryNumbers extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async delete(numberId: string): Promise<any> {
    return this._http.delete(this._path(numberId));
  }
}

/** 10DLC Campaign Registry namespace. */
export class RegistryNamespace {
  readonly brands: RegistryBrands;
  readonly campaigns: RegistryCampaigns;
  readonly orders: RegistryOrders;
  readonly numbers: RegistryNumbers;

  constructor(http: HttpClient) {
    const base = '/api/relay/rest/registry/beta';
    this.brands = new RegistryBrands(http, `${base}/brands`);
    this.campaigns = new RegistryCampaigns(http, `${base}/campaigns`);
    this.orders = new RegistryOrders(http, `${base}/orders`);
    this.numbers = new RegistryNumbers(http, `${base}/numbers`);
  }
}
