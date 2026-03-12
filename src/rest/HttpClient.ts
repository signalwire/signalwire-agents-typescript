/**
 * HttpClient — fetch-based HTTP with Basic Auth.
 *
 * All methods return parsed JSON. Throws RestError on non-2xx responses.
 * Returns {} on 204 No Content.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import { getLogger } from '../Logger.js';
import { RestError } from './RestError.js';
import type { HttpClientOptions, QueryParams } from './types.js';

const logger = getLogger('rest_client');

export class HttpClient {
  readonly baseUrl: string;
  private readonly _authHeader: string;
  private readonly _fetch: typeof globalThis.fetch;

  constructor(options: HttpClientOptions) {
    this.baseUrl = options.baseUrl.replace(/\/+$/, '');
    this._authHeader = 'Basic ' + Buffer.from(`${options.project}:${options.token}`).toString('base64');
    this._fetch = options.fetchImpl ?? globalThis.fetch;
  }

  private async _request<T = any>(method: string, path: string, body?: any, params?: QueryParams): Promise<T> {
    let url = path.startsWith('http') ? path : `${this.baseUrl}${path}`;

    if (params) {
      const qs = new URLSearchParams();
      for (const [k, v] of Object.entries(params)) {
        if (v !== undefined) qs.set(k, String(v));
      }
      const qsStr = qs.toString();
      if (qsStr) url += (url.includes('?') ? '&' : '?') + qsStr;
    }

    logger.debug(`${method} ${url}`);

    const headers: Record<string, string> = {
      'Authorization': this._authHeader,
      'Accept': 'application/json',
      'User-Agent': 'signalwire-agents-ts/0.1.0',
    };
    if (body !== undefined) {
      headers['Content-Type'] = 'application/json';
    }

    const resp = await this._fetch(url, {
      method,
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (!resp.ok) {
      const text = await resp.text();
      throw new RestError(resp.status, text, url, method);
    }

    if (resp.status === 204) {
      return {} as T;
    }

    const text = await resp.text();
    if (!text) return {} as T;
    return JSON.parse(text) as T;
  }

  async get<T = any>(path: string, params?: QueryParams): Promise<T> {
    return this._request<T>('GET', path, undefined, params);
  }

  async post<T = any>(path: string, body?: any, params?: QueryParams): Promise<T> {
    return this._request<T>('POST', path, body, params);
  }

  async put<T = any>(path: string, body?: any): Promise<T> {
    return this._request<T>('PUT', path, body);
  }

  async patch<T = any>(path: string, body?: any): Promise<T> {
    return this._request<T>('PATCH', path, body);
  }

  async delete<T = any>(path: string): Promise<T> {
    return this._request<T>('DELETE', path);
  }
}
