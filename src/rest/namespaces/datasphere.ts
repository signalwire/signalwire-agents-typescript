/**
 * Datasphere API namespace — document management and semantic search.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { CrudResource } from '../base/CrudResource.js';

/** Document management with search and chunk operations. */
export class DatasphereDocuments extends CrudResource {
  constructor(http: HttpClient) {
    super(http, '/api/datasphere/documents');
  }

  /** Semantic search across documents. */
  async search(body: any): Promise<any> {
    return this._http.post(this._path('search'), body);
  }

  /** List chunks for a document. */
  async listChunks(documentId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(documentId, 'chunks'), params);
  }

  /** Get a specific chunk. */
  async getChunk(documentId: string, chunkId: string): Promise<any> {
    return this._http.get(this._path(documentId, 'chunks', chunkId));
  }

  /** Delete a specific chunk. */
  async deleteChunk(documentId: string, chunkId: string): Promise<any> {
    return this._http.delete(this._path(documentId, 'chunks', chunkId));
  }
}

/** Datasphere API namespace. */
export class DatasphereNamespace {
  readonly documents: DatasphereDocuments;

  constructor(http: HttpClient) {
    this.documents = new DatasphereDocuments(http);
  }
}
