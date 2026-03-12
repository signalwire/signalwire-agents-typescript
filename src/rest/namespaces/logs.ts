/**
 * Logs namespace — message, voice, fax, and conference logs (read-only).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';

/** Message log queries. */
export class MessageLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(logId: string): Promise<any> {
    return this._http.get(this._path(logId));
  }
}

/** Voice log queries. */
export class VoiceLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(logId: string): Promise<any> {
    return this._http.get(this._path(logId));
  }

  async listEvents(logId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(logId, 'events'), params);
  }
}

/** Fax log queries. */
export class FaxLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(logId: string): Promise<any> {
    return this._http.get(this._path(logId));
  }
}

/** Conference log queries. */
export class ConferenceLogs extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }
}

/** Logs API namespace. */
export class LogsNamespace {
  readonly messages: MessageLogs;
  readonly voice: VoiceLogs;
  readonly fax: FaxLogs;
  readonly conferences: ConferenceLogs;

  constructor(http: HttpClient) {
    this.messages = new MessageLogs(http, '/api/messaging/logs');
    this.voice = new VoiceLogs(http, '/api/voice/logs');
    this.fax = new FaxLogs(http, '/api/fax/logs');
    this.conferences = new ConferenceLogs(http, '/api/logs/conferences');
  }
}
