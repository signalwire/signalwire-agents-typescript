/**
 * Compatibility API namespace — Twilio-compatible LAML API with AccountSid scoping.
 *
 * All updates use POST (Twilio-compatible, not REST-idiomatic PATCH/PUT).
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import type { QueryParams } from '../types.js';
import { BaseResource } from '../base/BaseResource.js';
import { CrudResource } from '../base/CrudResource.js';

/** Compat account/subproject management. */
export class CompatAccounts extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/laml/2010-04-01/Accounts');
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async create(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }
}

/** Compat call management with recording and stream sub-resources. */
export class CompatCalls extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  async startRecording(callSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(callSid, 'Recordings'), body);
  }

  async updateRecording(callSid: string, recordingSid: string, body: any): Promise<any> {
    return this._http.post(this._path(callSid, 'Recordings', recordingSid), body);
  }

  async startStream(callSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(callSid, 'Streams'), body);
  }

  async stopStream(callSid: string, streamSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(callSid, 'Streams', streamSid), body);
  }
}

/** Compat message management with media sub-resources. */
export class CompatMessages extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  async listMedia(messageSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(messageSid, 'Media'), params);
  }

  async getMedia(messageSid: string, mediaSid: string): Promise<any> {
    return this._http.get(this._path(messageSid, 'Media', mediaSid));
  }

  async deleteMedia(messageSid: string, mediaSid: string): Promise<any> {
    return this._http.delete(this._path(messageSid, 'Media', mediaSid));
  }
}

/** Compat fax management with media sub-resources. */
export class CompatFaxes extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  async listMedia(faxSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(faxSid, 'Media'), params);
  }

  async getMedia(faxSid: string, mediaSid: string): Promise<any> {
    return this._http.get(this._path(faxSid, 'Media', mediaSid));
  }

  async deleteMedia(faxSid: string, mediaSid: string): Promise<any> {
    return this._http.delete(this._path(faxSid, 'Media', mediaSid));
  }
}

/** Compat conference management with participants, recordings, and streams. */
export class CompatConferences extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  // Participants
  async listParticipants(conferenceSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Participants'), params);
  }

  async getParticipant(conferenceSid: string, callSid: string): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Participants', callSid));
  }

  async updateParticipant(conferenceSid: string, callSid: string, body: any): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Participants', callSid), body);
  }

  async removeParticipant(conferenceSid: string, callSid: string): Promise<any> {
    return this._http.delete(this._path(conferenceSid, 'Participants', callSid));
  }

  // Conference recordings
  async listRecordings(conferenceSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Recordings'), params);
  }

  async getRecording(conferenceSid: string, recordingSid: string): Promise<any> {
    return this._http.get(this._path(conferenceSid, 'Recordings', recordingSid));
  }

  async updateRecording(conferenceSid: string, recordingSid: string, body: any): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Recordings', recordingSid), body);
  }

  async deleteRecording(conferenceSid: string, recordingSid: string): Promise<any> {
    return this._http.delete(this._path(conferenceSid, 'Recordings', recordingSid));
  }

  // Conference streams
  async startStream(conferenceSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Streams'), body);
  }

  async stopStream(conferenceSid: string, streamSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(conferenceSid, 'Streams', streamSid), body);
  }
}

/** Compat phone number management. */
export class CompatPhoneNumbers extends BaseResource {
  private readonly _availableBase: string;

  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
    this._availableBase = basePath.replace('/IncomingPhoneNumbers', '/AvailablePhoneNumbers');
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async purchase(body: any): Promise<any> {
    return this._http.post(this._basePath, body);
  }

  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  async delete(sid: string): Promise<any> {
    return this._http.delete(this._path(sid));
  }

  async importNumber(body: any): Promise<any> {
    const path = this._basePath.replace('/IncomingPhoneNumbers', '/ImportedPhoneNumbers');
    return this._http.post(path, body);
  }

  async listAvailableCountries(params?: QueryParams): Promise<any> {
    return this._http.get(this._availableBase, params);
  }

  async searchLocal(country: string, params?: QueryParams): Promise<any> {
    return this._http.get(`${this._availableBase}/${country}/Local`, params);
  }

  async searchTollFree(country: string, params?: QueryParams): Promise<any> {
    return this._http.get(`${this._availableBase}/${country}/TollFree`, params);
  }
}

/** Compat application management. */
export class CompatApplications extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }
}

/** Compat cXML/LaML script management. */
export class CompatLamlBins extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }
}

/** Compat queue management with members. */
export class CompatQueues extends CrudResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  override async update(sid: string, body: any): Promise<any> {
    return this._http.post(this._path(sid), body);
  }

  async listMembers(queueSid: string, params?: QueryParams): Promise<any> {
    return this._http.get(this._path(queueSid, 'Members'), params);
  }

  async getMember(queueSid: string, callSid: string): Promise<any> {
    return this._http.get(this._path(queueSid, 'Members', callSid));
  }

  async dequeueMember(queueSid: string, callSid: string, body: any = {}): Promise<any> {
    return this._http.post(this._path(queueSid, 'Members', callSid), body);
  }
}

/** Compat recording management. */
export class CompatRecordings extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  async delete(sid: string): Promise<any> {
    return this._http.delete(this._path(sid));
  }
}

/** Compat transcription management. */
export class CompatTranscriptions extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
  }

  async list(params?: QueryParams): Promise<any> {
    return this._http.get(this._basePath, params);
  }

  async get(sid: string): Promise<any> {
    return this._http.get(this._path(sid));
  }

  async delete(sid: string): Promise<any> {
    return this._http.delete(this._path(sid));
  }
}

/** Compat API token management. */
export class CompatTokens extends BaseResource {
  constructor(http: HttpClient, basePath: string) {
    super(http, basePath);
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

/** Twilio-compatible LAML API namespace with AccountSid scoping. */
export class CompatNamespace {
  readonly accounts: CompatAccounts;
  readonly calls: CompatCalls;
  readonly messages: CompatMessages;
  readonly faxes: CompatFaxes;
  readonly conferences: CompatConferences;
  readonly phoneNumbers: CompatPhoneNumbers;
  readonly applications: CompatApplications;
  readonly lamlBins: CompatLamlBins;
  readonly queues: CompatQueues;
  readonly recordings: CompatRecordings;
  readonly transcriptions: CompatTranscriptions;
  readonly tokens: CompatTokens;

  constructor(http: HttpClient, accountSid: string) {
    const base = `/api/laml/2010-04-01/Accounts/${accountSid}`;

    this.accounts = new CompatAccounts(http);
    this.calls = new CompatCalls(http, `${base}/Calls`);
    this.messages = new CompatMessages(http, `${base}/Messages`);
    this.faxes = new CompatFaxes(http, `${base}/Faxes`);
    this.conferences = new CompatConferences(http, `${base}/Conferences`);
    this.phoneNumbers = new CompatPhoneNumbers(http, `${base}/IncomingPhoneNumbers`);
    this.applications = new CompatApplications(http, `${base}/Applications`);
    this.lamlBins = new CompatLamlBins(http, `${base}/LamlBins`);
    this.queues = new CompatQueues(http, `${base}/Queues`);
    this.recordings = new CompatRecordings(http, `${base}/Recordings`);
    this.transcriptions = new CompatTranscriptions(http, `${base}/Transcriptions`);
    this.tokens = new CompatTokens(http, `${base}/tokens`);
  }
}
