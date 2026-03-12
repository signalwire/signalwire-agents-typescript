/**
 * Calling API namespace — REST-based call control via command dispatch.
 *
 * All commands are sent as POST /api/calling/calls with a command field.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

import type { HttpClient } from '../HttpClient.js';
import { BaseResource } from '../base/BaseResource.js';

/** REST call control — all 37 commands dispatched via single POST endpoint. */
export class CallingNamespace extends BaseResource {
  constructor(http: HttpClient) {
    super(http, '/api/calling/calls');
  }

  private async _execute(command: string, callId?: string, params: any = {}): Promise<any> {
    const body: any = { command, params };
    if (callId !== undefined) {
      body.id = callId;
    }
    return this._http.post(this._basePath, body);
  }

  // Call lifecycle
  async dial(params: any = {}): Promise<any> {
    return this._execute('dial', undefined, params);
  }

  async update(params: any = {}): Promise<any> {
    return this._execute('update', undefined, params);
  }

  async end(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.end', callId, params);
  }

  async transfer(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transfer', callId, params);
  }

  async disconnect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.disconnect', callId, params);
  }

  // Play
  async play(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play', callId, params);
  }

  async playPause(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.pause', callId, params);
  }

  async playResume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.resume', callId, params);
  }

  async playStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.stop', callId, params);
  }

  async playVolume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.play.volume', callId, params);
  }

  // Record
  async record(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record', callId, params);
  }

  async recordPause(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.pause', callId, params);
  }

  async recordResume(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.resume', callId, params);
  }

  async recordStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.record.stop', callId, params);
  }

  // Collect
  async collect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect', callId, params);
  }

  async collectStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect.stop', callId, params);
  }

  async collectStartInputTimers(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.collect.start_input_timers', callId, params);
  }

  // Detect
  async detect(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.detect', callId, params);
  }

  async detectStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.detect.stop', callId, params);
  }

  // Tap
  async tap(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.tap', callId, params);
  }

  async tapStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.tap.stop', callId, params);
  }

  // Stream
  async stream(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.stream', callId, params);
  }

  async streamStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.stream.stop', callId, params);
  }

  // Denoise
  async denoise(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.denoise', callId, params);
  }

  async denoiseStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.denoise.stop', callId, params);
  }

  // Transcribe
  async transcribe(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transcribe', callId, params);
  }

  async transcribeStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.transcribe.stop', callId, params);
  }

  // AI
  async aiMessage(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_message', callId, params);
  }

  async aiHold(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_hold', callId, params);
  }

  async aiUnhold(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai_unhold', callId, params);
  }

  async aiStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.ai.stop', callId, params);
  }

  // Live transcribe / translate
  async liveTranscribe(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.live_transcribe', callId, params);
  }

  async liveTranslate(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.live_translate', callId, params);
  }

  // Fax
  async sendFaxStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.send_fax.stop', callId, params);
  }

  async receiveFaxStop(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.receive_fax.stop', callId, params);
  }

  // SIP
  async refer(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.refer', callId, params);
  }

  // Custom events
  async userEvent(callId: string, params: any = {}): Promise<any> {
    return this._execute('calling.user_event', callId, params);
  }
}
