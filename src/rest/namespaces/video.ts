/**
 * Video API namespace — rooms, sessions, recordings, conferences, tokens, streams.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudResource } from '../base/CrudResource.js';

/** Video room management with streams. */
export class VideoRooms extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async listStreams(roomId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(roomId, 'streams'), params);
  }

  async createStream(roomId: string, body: any): Promise<any> {
    return this._http.post(this._path(roomId, 'streams'), body);
  }
}

/** Video room token generation. */
export class VideoRoomTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }
}

/** Video room session management. */
export class VideoRoomSessions extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(sessionId: string): Promise<any> {
    return this._http.get(this._path(sessionId));
  }

  async listEvents(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'events'), params);
  }

  async listMembers(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'members'), params);
  }

  async listRecordings(sessionId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(sessionId, 'recordings'), params);
  }
}

/** Video room recording management. */
export class VideoRoomRecordings extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(recordingId: string): Promise<any> {
    return this._http.get(this._path(recordingId));
  }

  async delete(recordingId: string): Promise<any> {
    return this._http.delete(this._path(recordingId));
  }

  async listEvents(recordingId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(recordingId, 'events'), params);
  }
}

/** Video conference management with tokens and streams. */
export class VideoConferences extends CrudResource {
  protected override _updateMethod: 'PATCH' | 'PUT' = 'PUT';

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async listConferenceTokens(conferenceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceId, 'conference_tokens'), params);
  }

  async listStreams(conferenceId: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceId, 'streams'), params);
  }

  async createStream(conferenceId: string, body: any): Promise<any> {
    return this._http.post(this._path(conferenceId, 'streams'), body);
  }
}

/** Video conference token management. */
export class VideoConferenceTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async get(tokenId: string): Promise<any> {
    return this._http.get(this._path(tokenId));
  }

  async reset(tokenId: string): Promise<any> {
    return this._http.post(this._path(tokenId, 'reset'));
  }
}

/** Video stream management. */
export class VideoStreams extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async get(streamId: string): Promise<any> {
    return this._http.get(this._path(streamId));
  }

  async update(streamId: string, body: any): Promise<any> {
    return this._http.put(this._path(streamId), body);
  }

  async delete(streamId: string): Promise<any> {
    return this._http.delete(this._path(streamId));
  }
}

/** Video API namespace. */
export class VideoNamespace {
  readonly rooms: VideoRooms;
  readonly roomTokens: VideoRoomTokens;
  readonly roomSessions: VideoRoomSessions;
  readonly roomRecordings: VideoRoomRecordings;
  readonly conferences: VideoConferences;
  readonly conferenceTokens: VideoConferenceTokens;
  readonly streams: VideoStreams;

  constructor(http: HttpClient) {
    const base = '/api/video';
    this.rooms = new VideoRooms(http, `${base}/rooms`);
    this.roomTokens = new VideoRoomTokens(http, `${base}/room_tokens`);
    this.roomSessions = new VideoRoomSessions(http, `${base}/room_sessions`);
    this.roomRecordings = new VideoRoomRecordings(http, `${base}/room_recordings`);
    this.conferences = new VideoConferences(http, `${base}/conferences`);
    this.conferenceTokens = new VideoConferenceTokens(http, `${base}/conference_tokens`);
    this.streams = new VideoStreams(http, `${base}/streams`);
  }
}
