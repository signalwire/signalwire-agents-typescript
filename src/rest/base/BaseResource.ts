/**
 * Abstract base class for all REST resources.
 */
import type { HttpClient } from '../HttpClient.js';

export abstract class BaseResource {
  protected readonly _http: HttpClient;
  protected readonly _basePath: string;

  constructor(http: HttpClient, basePath: string) {
    this._http = http;
    this._basePath = basePath;
  }

  /** Build a sub-resource path by joining parts onto the base path. */
  protected _path(...parts: string[]): string {
    return [this._basePath, ...parts].join('/');
  }
}
