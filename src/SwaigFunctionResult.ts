/**
 * SwaigFunctionResult - Builder for SWAIG function responses.
 *
 * Carries response text and a list of structured actions (connect, hangup, SMS, etc.).
 * Every mutating method returns `this` for fluent chaining.
 */

/** Prompt configuration for a payment collection flow. */
export interface PaymentPrompt {
  /** The situation this prompt applies to (e.g., "payment-card-number"). */
  for: string;
  /** Actions to perform for this prompt. */
  actions: PaymentAction[];
  /** Optional card type filter for this prompt. */
  card_type?: string;
  /** Optional error type this prompt handles. */
  error_type?: string;
}

/** A single action within a payment prompt (e.g., say or play). */
export interface PaymentAction {
  /** The action type (e.g., "say", "play"). */
  type: string;
  /** The phrase or URL to use for this action. */
  phrase: string;
}

/** A custom key-value parameter passed to the payment connector. */
export interface PaymentParameter {
  /** The parameter name. */
  name: string;
  /** The parameter value. */
  value: string;
}

/**
 * Builder for SWAIG function responses.
 *
 * Carries response text and a list of structured actions (connect, hangup, SMS, etc.).
 * Every mutating method returns `this` for fluent chaining.
 */
export class SwaigFunctionResult {
  /** The text response returned to the AI agent. */
  response: string;
  /** Ordered list of actions to execute after the response. */
  action: Record<string, unknown>[];
  /** Whether actions should be post-processed after the AI responds. */
  postProcess: boolean;

  /**
   * @param response - Initial response text; defaults to empty string.
   * @param postProcess - Whether to enable post-processing of actions.
   */
  constructor(response?: string, postProcess = false) {
    this.response = response ?? '';
    this.action = [];
    this.postProcess = postProcess;
  }

  // ── Core ────────────────────────────────────────────────────────────

  /**
   * Set the response text returned to the AI agent.
   * @param response - The response text.
   * @returns This instance for chaining.
   */
  setResponse(response: string): this {
    this.response = response;
    return this;
  }

  /**
   * Enable or disable post-processing of actions.
   * @param postProcess - Whether to post-process actions.
   * @returns This instance for chaining.
   */
  setPostProcess(postProcess: boolean): this {
    this.postProcess = postProcess;
    return this;
  }

  /**
   * Append a single named action to the action list.
   * @param name - The action name (e.g., "hangup", "say").
   * @param data - The action payload.
   * @returns This instance for chaining.
   */
  addAction(name: string, data: unknown): this {
    this.action.push({ [name]: data });
    return this;
  }

  /**
   * Append multiple action objects to the action list.
   * @param actions - Array of action objects to append.
   * @returns This instance for chaining.
   */
  addActions(actions: Record<string, unknown>[]): this {
    this.action.push(...actions);
    return this;
  }

  // ── Call control ────────────────────────────────────────────────────

  /**
   * Connect the call to another destination via SWML transfer.
   * @param destination - The destination address (phone number or SIP URI).
   * @param final - Whether this is a final transfer that ends the AI session.
   * @param fromAddr - Optional caller ID to use for the outbound leg.
   * @returns This instance for chaining.
   */
  connect(destination: string, final = true, fromAddr?: string): this {
    const connectParams: Record<string, string> = { to: destination };
    if (fromAddr !== undefined) {
      connectParams['from'] = fromAddr;
    }
    this.action.push({
      SWML: {
        sections: { main: [{ connect: connectParams }] },
        version: '1.0.0',
      },
      transfer: String(final),
    });
    return this;
  }

  /**
   * Transfer the call to a SWML destination with a custom AI response.
   * @param dest - The transfer destination.
   * @param aiResponse - The AI response text to set before transferring.
   * @param final - Whether this is a final transfer.
   * @returns This instance for chaining.
   */
  swmlTransfer(dest: string, aiResponse: string, final = true): this {
    this.action.push({
      SWML: {
        version: '1.0.0',
        sections: {
          main: [
            { set: { ai_response: aiResponse } },
            { transfer: { dest } },
          ],
        },
      },
      transfer: String(final),
    });
    return this;
  }

  /**
   * Hang up the call.
   * @returns This instance for chaining.
   */
  hangup(): this {
    return this.addAction('hangup', true);
  }

  /**
   * Place the call on hold for a specified duration.
   * @param timeout - Hold duration in seconds, clamped to 0-900.
   * @returns This instance for chaining.
   */
  hold(timeout = 300): this {
    return this.addAction('hold', Math.max(0, Math.min(timeout, 900)));
  }

  /**
   * Wait for user input before continuing.
   * @param opts - Options controlling wait behavior: enable/disable, timeout, or answer-first mode.
   * @returns This instance for chaining.
   */
  waitForUser(opts?: { enabled?: boolean; timeout?: number; answerFirst?: boolean }): this {
    let value: unknown = true;
    if (opts?.answerFirst) {
      value = 'answer_first';
    } else if (opts?.timeout !== undefined) {
      value = opts.timeout;
    } else if (opts?.enabled !== undefined) {
      value = opts.enabled;
    }
    return this.addAction('wait_for_user', value);
  }

  /**
   * Stop the AI session.
   * @returns This instance for chaining.
   */
  stop(): this {
    return this.addAction('stop', true);
  }

  // ── Audio ───────────────────────────────────────────────────────────

  /**
   * Speak text to the caller via TTS.
   * @param text - The text to speak.
   * @returns This instance for chaining.
   */
  say(text: string): this {
    return this.addAction('say', text);
  }

  /**
   * Play an audio file in the background during the call.
   * @param filename - URL or path of the audio file.
   * @param wait - Whether to wait for playback to complete before continuing.
   * @returns This instance for chaining.
   */
  playBackgroundFile(filename: string, wait = false): this {
    if (wait) {
      return this.addAction('playback_bg', { file: filename, wait: true });
    }
    return this.addAction('playback_bg', filename);
  }

  /**
   * Stop any currently playing background audio file.
   * @returns This instance for chaining.
   */
  stopBackgroundFile(): this {
    return this.addAction('stop_playback_bg', true);
  }

  // ── Speech ──────────────────────────────────────────────────────────

  /**
   * Add dynamic speech recognition hints to improve transcription accuracy.
   * @param hints - Array of hint strings or pattern-replacement objects.
   * @returns This instance for chaining.
   */
  addDynamicHints(hints: (string | { pattern: string; replace: string; ignore_case?: boolean })[]): this {
    return this.addAction('add_dynamic_hints', hints);
  }

  /**
   * Remove all previously added dynamic speech hints.
   * @returns This instance for chaining.
   */
  clearDynamicHints(): this {
    this.action.push({ clear_dynamic_hints: {} });
    return this;
  }

  /**
   * Set the silence duration that marks the end of a user's speech.
   * @param milliseconds - Timeout in milliseconds.
   * @returns This instance for chaining.
   */
  setEndOfSpeechTimeout(milliseconds: number): this {
    return this.addAction('end_of_speech_timeout', milliseconds);
  }

  /**
   * Set the timeout for speech event detection.
   * @param milliseconds - Timeout in milliseconds.
   * @returns This instance for chaining.
   */
  setSpeechEventTimeout(milliseconds: number): this {
    return this.addAction('speech_event_timeout', milliseconds);
  }

  // ── Data ────────────────────────────────────────────────────────────

  /**
   * Merge key-value pairs into the global data store shared across functions.
   * @param data - Key-value pairs to set or update.
   * @returns This instance for chaining.
   */
  updateGlobalData(data: Record<string, unknown>): this {
    return this.addAction('set_global_data', data);
  }

  /**
   * Remove keys from the global data store.
   * @param keys - A single key or array of keys to remove.
   * @returns This instance for chaining.
   */
  removeGlobalData(keys: string | string[]): this {
    return this.addAction('unset_global_data', keys);
  }

  /**
   * Set metadata key-value pairs on the current call.
   * @param data - Metadata key-value pairs to set.
   * @returns This instance for chaining.
   */
  setMetadata(data: Record<string, unknown>): this {
    return this.addAction('set_meta_data', data);
  }

  /**
   * Remove metadata keys from the current call.
   * @param keys - A single key or array of keys to remove.
   * @returns This instance for chaining.
   */
  removeMetadata(keys: string | string[]): this {
    return this.addAction('unset_meta_data', keys);
  }

  // ── SWML helpers ────────────────────────────────────────────────────

  /**
   * Execute arbitrary SWML content as an action.
   * @param swmlContent - SWML as a JSON string or object.
   * @param transfer - Whether this SWML execution should transfer the call.
   * @returns This instance for chaining.
   */
  executeSwml(swmlContent: string | Record<string, unknown>, transfer = false): this {
    let swmlData: Record<string, unknown>;
    if (typeof swmlContent === 'string') {
      try {
        swmlData = JSON.parse(swmlContent) as Record<string, unknown>;
      } catch {
        swmlData = { raw_swml: swmlContent };
      }
    } else {
      swmlData = { ...swmlContent };
    }
    if (transfer) {
      swmlData['transfer'] = 'true';
    }
    return this.addAction('SWML', swmlData);
  }

  /**
   * Change the current SWML step.
   * @param stepName - The name of the step to switch to.
   * @returns This instance for chaining.
   */
  swmlChangeStep(stepName: string): this {
    return this.addAction('change_step', stepName);
  }

  /**
   * Change the current SWML context.
   * @param contextName - The name of the context to switch to.
   * @returns This instance for chaining.
   */
  swmlChangeContext(contextName: string): this {
    return this.addAction('change_context', contextName);
  }

  /**
   * Emit a custom user event via SWML.
   * @param eventData - The event payload.
   * @returns This instance for chaining.
   */
  swmlUserEvent(eventData: Record<string, unknown>): this {
    return this.addAction('SWML', {
      sections: { main: [{ user_event: { event: eventData } }] },
      version: '1.0.0',
    });
  }

  /**
   * Switch the AI context with optional new prompts and reset options.
   * @param opts - Context switch options including system/user prompts and reset flags.
   * @returns This instance for chaining.
   */
  switchContext(opts?: {
    systemPrompt?: string;
    userPrompt?: string;
    consolidate?: boolean;
    fullReset?: boolean;
  }): this {
    const sp = opts?.systemPrompt;
    const up = opts?.userPrompt;
    const cons = opts?.consolidate;
    const fr = opts?.fullReset;

    if (sp && !up && !cons && !fr) {
      return this.addAction('context_switch', sp);
    }
    const data: Record<string, unknown> = {};
    if (sp) data['system_prompt'] = sp;
    if (up) data['user_prompt'] = up;
    if (cons) data['consolidate'] = true;
    if (fr) data['full_reset'] = true;
    return this.addAction('context_switch', data);
  }

  // ── Functions ───────────────────────────────────────────────────────

  /**
   * Enable or disable SWAIG functions by name.
   * @param toggles - Array of function name and active state pairs.
   * @returns This instance for chaining.
   */
  toggleFunctions(toggles: { function: string; active: boolean }[]): this {
    return this.addAction('toggle_functions', toggles);
  }

  /**
   * Control whether functions fire on speaker timeout.
   * @param enabled - Whether to enable function execution on timeout.
   * @returns This instance for chaining.
   */
  enableFunctionsOnTimeout(enabled = true): this {
    return this.addAction('functions_on_speaker_timeout', enabled);
  }

  /**
   * Update AI engine settings at runtime.
   * @param settings - Key-value pairs of settings to update.
   * @returns This instance for chaining.
   */
  updateSettings(settings: Record<string, unknown>): this {
    return this.addAction('settings', settings);
  }

  // ── User input / history ────────────────────────────────────────────

  /**
   * Inject text as if the user had spoken it.
   * @param text - The simulated user input text.
   * @returns This instance for chaining.
   */
  simulateUserInput(text: string): this {
    return this.addAction('user_input', text);
  }

  /**
   * Enable or disable extensive data reporting in function calls.
   * @param enabled - Whether to enable extensive data.
   * @returns This instance for chaining.
   */
  enableExtensiveData(enabled = true): this {
    return this.addAction('extensive_data', enabled);
  }

  /**
   * Replace the function call output in conversation history.
   * @param text - Replacement text, or true to replace with the response.
   * @returns This instance for chaining.
   */
  replaceInHistory(text: string | boolean = true): this {
    return this.addAction('replace_in_history', text);
  }

  // ── Comms ───────────────────────────────────────────────────────────

  /**
   * Send an SMS or MMS message from within the call flow.
   * @param opts - SMS parameters including to/from numbers and body or media.
   * @returns This instance for chaining.
   */
  sendSms(opts: {
    toNumber: string;
    fromNumber: string;
    body?: string;
    media?: string[];
    tags?: string[];
    region?: string;
  }): this {
    if (!opts.body && !opts.media) {
      throw new Error('Either body or media must be provided');
    }
    const smsParams: Record<string, unknown> = {
      to_number: opts.toNumber,
      from_number: opts.fromNumber,
    };
    if (opts.body) smsParams['body'] = opts.body;
    if (opts.media) smsParams['media'] = opts.media;
    if (opts.tags) smsParams['tags'] = opts.tags;
    if (opts.region) smsParams['region'] = opts.region;

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ send_sms: smsParams }] },
    });
  }

  /**
   * Start recording the call.
   * @param opts - Recording options including format, direction, and timeouts.
   * @returns This instance for chaining.
   */
  recordCall(opts?: {
    controlId?: string;
    stereo?: boolean;
    format?: 'wav' | 'mp3';
    direction?: 'speak' | 'listen' | 'both';
    terminators?: string;
    beep?: boolean;
    inputSensitivity?: number;
    initialTimeout?: number;
    endSilenceTimeout?: number;
    maxLength?: number;
    statusUrl?: string;
  }): this {
    const format = opts?.format ?? 'wav';
    const direction = opts?.direction ?? 'both';
    const params: Record<string, unknown> = {
      stereo: opts?.stereo ?? false,
      format,
      direction,
      beep: opts?.beep ?? false,
      input_sensitivity: opts?.inputSensitivity ?? 44.0,
    };
    if (opts?.controlId) params['control_id'] = opts.controlId;
    if (opts?.terminators) params['terminators'] = opts.terminators;
    if (opts?.initialTimeout !== undefined) params['initial_timeout'] = opts.initialTimeout;
    if (opts?.endSilenceTimeout !== undefined) params['end_silence_timeout'] = opts.endSilenceTimeout;
    if (opts?.maxLength !== undefined) params['max_length'] = opts.maxLength;
    if (opts?.statusUrl) params['status_url'] = opts.statusUrl;

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ record_call: params }] },
    });
  }

  /**
   * Stop an active call recording.
   * @param controlId - Optional control ID of the recording to stop.
   * @returns This instance for chaining.
   */
  stopRecordCall(controlId?: string): this {
    const params: Record<string, unknown> = {};
    if (controlId) params['control_id'] = controlId;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ stop_record_call: params }] },
    });
  }

  /**
   * Start a media tap to stream audio to an external URI.
   * @param opts - Tap parameters including URI, direction, and codec.
   * @returns This instance for chaining.
   */
  tap(opts: {
    uri: string;
    controlId?: string;
    direction?: 'speak' | 'hear' | 'both';
    codec?: 'PCMU' | 'PCMA';
    rtpPtime?: number;
    statusUrl?: string;
  }): this {
    const params: Record<string, unknown> = { uri: opts.uri };
    if (opts.controlId) params['control_id'] = opts.controlId;
    if (opts.direction && opts.direction !== 'both') params['direction'] = opts.direction;
    if (opts.codec && opts.codec !== 'PCMU') params['codec'] = opts.codec;
    if (opts.rtpPtime && opts.rtpPtime !== 20) params['rtp_ptime'] = opts.rtpPtime;
    if (opts.statusUrl) params['status_url'] = opts.statusUrl;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ tap: params }] },
    });
  }

  /**
   * Stop an active media tap.
   * @param controlId - Optional control ID of the tap to stop.
   * @returns This instance for chaining.
   */
  stopTap(controlId?: string): this {
    const params: Record<string, unknown> = {};
    if (controlId) params['control_id'] = controlId;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ stop_tap: params }] },
    });
  }

  // ── Rooms / Conferences ─────────────────────────────────────────────

  /**
   * Join a SignalWire room.
   * @param name - The room name to join.
   * @returns This instance for chaining.
   */
  joinRoom(name: string): this {
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ join_room: { name } }] },
    });
  }

  /**
   * Send a SIP REFER to transfer the call.
   * @param toUri - The SIP URI to refer the call to.
   * @returns This instance for chaining.
   */
  sipRefer(toUri: string): this {
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ sip_refer: { to_uri: toUri } }] },
    });
  }

  /**
   * Join a conference by name with optional configuration.
   * @param name - The conference name to join.
   * @param opts - Optional conference settings such as mute, recording, and callbacks.
   * @returns This instance for chaining.
   */
  joinConference(name: string, opts?: {
    muted?: boolean;
    beep?: 'true' | 'false' | 'onEnter' | 'onExit';
    startOnEnter?: boolean;
    endOnExit?: boolean;
    waitUrl?: string;
    maxParticipants?: number;
    record?: 'do-not-record' | 'record-from-start';
    region?: string;
    trim?: 'trim-silence' | 'do-not-trim';
    coach?: string;
    statusCallbackEvent?: string;
    statusCallback?: string;
    statusCallbackMethod?: 'GET' | 'POST';
    recordingStatusCallback?: string;
    recordingStatusCallbackMethod?: 'GET' | 'POST';
    recordingStatusCallbackEvent?: string;
    result?: unknown;
  }): this {
    const hasNonDefaults = opts && (
      opts.muted || (opts.beep && opts.beep !== 'true') ||
      opts.startOnEnter === false || opts.endOnExit ||
      opts.waitUrl || (opts.maxParticipants && opts.maxParticipants !== 250) ||
      (opts.record && opts.record !== 'do-not-record') || opts.region ||
      (opts.trim && opts.trim !== 'trim-silence') || opts.coach ||
      opts.statusCallbackEvent || opts.statusCallback ||
      (opts.statusCallbackMethod && opts.statusCallbackMethod !== 'POST') ||
      opts.recordingStatusCallback ||
      (opts.recordingStatusCallbackMethod && opts.recordingStatusCallbackMethod !== 'POST') ||
      (opts.recordingStatusCallbackEvent && opts.recordingStatusCallbackEvent !== 'completed') ||
      opts.result !== undefined
    );

    let joinParams: unknown;
    if (!hasNonDefaults) {
      joinParams = name;
    } else {
      const p: Record<string, unknown> = { name };
      if (opts!.muted) p['muted'] = opts!.muted;
      if (opts!.beep && opts!.beep !== 'true') p['beep'] = opts!.beep;
      if (opts!.startOnEnter === false) p['start_on_enter'] = false;
      if (opts!.endOnExit) p['end_on_exit'] = opts!.endOnExit;
      if (opts!.waitUrl) p['wait_url'] = opts!.waitUrl;
      if (opts!.maxParticipants && opts!.maxParticipants !== 250) p['max_participants'] = opts!.maxParticipants;
      if (opts!.record && opts!.record !== 'do-not-record') p['record'] = opts!.record;
      if (opts!.region) p['region'] = opts!.region;
      if (opts!.trim && opts!.trim !== 'trim-silence') p['trim'] = opts!.trim;
      if (opts!.coach) p['coach'] = opts!.coach;
      if (opts!.statusCallbackEvent) p['status_callback_event'] = opts!.statusCallbackEvent;
      if (opts!.statusCallback) p['status_callback'] = opts!.statusCallback;
      if (opts!.statusCallbackMethod && opts!.statusCallbackMethod !== 'POST') p['status_callback_method'] = opts!.statusCallbackMethod;
      if (opts!.recordingStatusCallback) p['recording_status_callback'] = opts!.recordingStatusCallback;
      if (opts!.recordingStatusCallbackMethod && opts!.recordingStatusCallbackMethod !== 'POST') p['recording_status_callback_method'] = opts!.recordingStatusCallbackMethod;
      if (opts!.recordingStatusCallbackEvent && opts!.recordingStatusCallbackEvent !== 'completed') p['recording_status_callback_event'] = opts!.recordingStatusCallbackEvent;
      if (opts!.result !== undefined) p['result'] = opts!.result;
      joinParams = p;
    }

    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ join_conference: joinParams }] },
    });
  }

  // ── RPC ─────────────────────────────────────────────────────────────

  /**
   * Execute a SignalWire RPC method via SWML.
   * @param opts - RPC parameters including method name and optional call/node IDs.
   * @returns This instance for chaining.
   */
  executeRpc(opts: {
    method: string;
    params?: Record<string, unknown>;
    callId?: string;
    nodeId?: string;
  }): this {
    const rpcParams: Record<string, unknown> = { method: opts.method };
    if (opts.callId) rpcParams['call_id'] = opts.callId;
    if (opts.nodeId) rpcParams['node_id'] = opts.nodeId;
    if (opts.params) rpcParams['params'] = opts.params;
    return this.executeSwml({
      version: '1.0.0',
      sections: { main: [{ execute_rpc: rpcParams }] },
    });
  }

  /**
   * Dial a number via RPC, optionally specifying device type.
   * @param toNumber - The destination phone number.
   * @param fromNumber - The caller ID number.
   * @param destSwml - The SWML destination for the dialed call.
   * @param deviceType - The device type (defaults to "phone").
   * @returns This instance for chaining.
   */
  rpcDial(toNumber: string, fromNumber: string, destSwml: string, deviceType = 'phone'): this {
    return this.executeRpc({
      method: 'dial',
      params: {
        devices: {
          type: deviceType,
          params: { to_number: toNumber, from_number: fromNumber },
        },
        dest_swml: destSwml,
      },
    });
  }

  /**
   * Send an AI message to another call via RPC.
   * @param callId - The target call ID.
   * @param messageText - The message text to inject.
   * @param role - The message role (defaults to "system").
   * @returns This instance for chaining.
   */
  rpcAiMessage(callId: string, messageText: string, role = 'system'): this {
    return this.executeRpc({
      method: 'ai_message',
      callId,
      params: { role, message_text: messageText },
    });
  }

  /**
   * Unhold a call that was previously placed on hold via RPC.
   * @param callId - The target call ID to unhold.
   * @returns This instance for chaining.
   */
  rpcAiUnhold(callId: string): this {
    return this.executeRpc({
      method: 'ai_unhold',
      callId,
      params: {},
    });
  }

  // ── Payment ─────────────────────────────────────────────────────────

  /**
   * Initiate a payment collection flow on the call.
   * @param opts - Payment configuration including connector URL, method, and prompt options.
   * @returns This instance for chaining.
   */
  pay(opts: {
    paymentConnectorUrl: string;
    inputMethod?: string;
    statusUrl?: string;
    paymentMethod?: string;
    timeout?: number;
    maxAttempts?: number;
    securityCode?: boolean;
    postalCode?: boolean | string;
    minPostalCodeLength?: number;
    tokenType?: string;
    chargeAmount?: string;
    currency?: string;
    language?: string;
    voice?: string;
    description?: string;
    validCardTypes?: string;
    parameters?: PaymentParameter[];
    prompts?: PaymentPrompt[];
    aiResponse?: string;
  }): this {
    const payParams: Record<string, unknown> = {
      payment_connector_url: opts.paymentConnectorUrl,
      input: opts.inputMethod ?? 'dtmf',
      payment_method: opts.paymentMethod ?? 'credit-card',
      timeout: String(opts.timeout ?? 5),
      max_attempts: String(opts.maxAttempts ?? 1),
      security_code: String(opts.securityCode ?? true),
      min_postal_code_length: String(opts.minPostalCodeLength ?? 0),
      token_type: opts.tokenType ?? 'reusable',
      currency: opts.currency ?? 'usd',
      language: opts.language ?? 'en-US',
      voice: opts.voice ?? 'woman',
      valid_card_types: opts.validCardTypes ?? 'visa mastercard amex',
    };

    const postalCode = opts.postalCode ?? true;
    payParams['postal_code'] = typeof postalCode === 'boolean' ? String(postalCode) : postalCode;

    if (opts.statusUrl) payParams['status_url'] = opts.statusUrl;
    if (opts.chargeAmount) payParams['charge_amount'] = opts.chargeAmount;
    if (opts.description) payParams['description'] = opts.description;
    if (opts.parameters) payParams['parameters'] = opts.parameters;
    if (opts.prompts) payParams['prompts'] = opts.prompts;

    const aiResponse = opts.aiResponse ??
      'The payment status is ${pay_result}, do not mention anything else about collecting payment if successful.';

    return this.executeSwml({
      version: '1.0.0',
      sections: {
        main: [
          { set: { ai_response: aiResponse } },
          { pay: payParams },
        ],
      },
    });
  }

  // ── Static payment helpers ──────────────────────────────────────────

  /**
   * Create a payment prompt configuration object.
   * @param forSituation - The situation this prompt applies to.
   * @param actions - Actions to perform for this prompt.
   * @param cardType - Optional card type filter.
   * @param errorType - Optional error type this prompt handles.
   * @returns A new PaymentPrompt object.
   */
  static createPaymentPrompt(
    forSituation: string,
    actions: PaymentAction[],
    cardType?: string,
    errorType?: string,
  ): PaymentPrompt {
    const prompt: PaymentPrompt = { for: forSituation, actions };
    if (cardType) prompt.card_type = cardType;
    if (errorType) prompt.error_type = errorType;
    return prompt;
  }

  /**
   * Create a payment action for use within a payment prompt.
   * @param actionType - The action type (e.g., "say", "play").
   * @param phrase - The phrase or URL for this action.
   * @returns A new PaymentAction object.
   */
  static createPaymentAction(actionType: string, phrase: string): PaymentAction {
    return { type: actionType, phrase };
  }

  /**
   * Create a custom payment parameter for the payment connector.
   * @param name - The parameter name.
   * @param value - The parameter value.
   * @returns A new PaymentParameter object.
   */
  static createPaymentParameter(name: string, value: string): PaymentParameter {
    return { name, value };
  }

  // ── Serialization ───────────────────────────────────────────────────

  /**
   * Serialize this result to a plain object for the SWAIG response.
   * @returns A dictionary with response, action, and post_process fields; falls back to "Action completed." if empty.
   */
  toDict(): Record<string, unknown> {
    const result: Record<string, unknown> = {};
    if (this.response) {
      result['response'] = this.response;
    }
    if (this.action.length > 0) {
      result['action'] = this.action;
    }
    if (this.postProcess && this.action.length > 0) {
      result['post_process'] = true;
    }
    if (Object.keys(result).length === 0) {
      result['response'] = 'Action completed.';
    }
    return result;
  }
}
