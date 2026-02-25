/**
 * Mock call data generation for swaig-test CLI.
 */

import { randomBytes } from 'node:crypto';

/** Options for generating mock call data in CLI testing. */
export interface MockCallOptions {
  /** Call transport type. */
  callType?: 'sip' | 'webrtc';
  /** Direction of the call. */
  callDirection?: 'inbound' | 'outbound';
  /** Current call state (e.g. "active", "ringing", "hold"). */
  callState?: string;
  /** Override the auto-generated call ID. */
  callId?: string;
  /** Caller's phone number. */
  fromNumber?: string;
  /** Destination extension or agent name. */
  toExtension?: string;
  /** Additional key-value overrides merged into the post data. */
  overrides?: Record<string, unknown>;
}

function randomId(): string {
  return randomBytes(16).toString('hex');
}

function randomUuid(): string {
  const hex = randomBytes(16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

/**
 * Generate a full mock POST body simulating an inbound SignalWire call request.
 * @param opts - Optional overrides for call metadata fields.
 * @returns A record representing the simulated call POST data.
 */
export function generateFakePostData(opts?: MockCallOptions): Record<string, unknown> {
  const callType = opts?.callType ?? 'webrtc';
  const callDirection = opts?.callDirection ?? 'inbound';
  const callState = opts?.callState ?? 'active';
  const fromNumber = opts?.fromNumber ?? '+15551234567';
  const toExtension = opts?.toExtension ?? 'test-agent';
  const callId = opts?.callId ?? randomUuid();
  const nodeId = randomUuid();
  const projectId = randomUuid();
  const spaceId = randomUuid();

  const data: Record<string, unknown> = {
    call_id: callId,
    call_type: callType,
    call_direction: callDirection,
    call_state: callState,
    node_id: nodeId,
    project_id: projectId,
    space_id: spaceId,
    caller_id_name: callType === 'sip' ? fromNumber : 'WebRTC User',
    caller_id_number: fromNumber,
    call_start_time: new Date().toISOString(),
    channel_type: callType === 'sip' ? 'phone' : 'web',
    from: fromNumber,
    to: toExtension,
    sip_headers: callType === 'sip' ? {
      'X-SignalWire-Agent': 'swaig-test-cli',
    } : undefined,
    vars: {
      call_type: callType,
      direction: callDirection,
    },
  };

  // Apply overrides
  if (opts?.overrides) {
    Object.assign(data, opts.overrides);
  }

  return data;
}

/**
 * Generate a minimal mock POST body for executing a single SWAIG function.
 * @param fnName - Name of the SWAIG function to invoke.
 * @param args - Arguments to pass to the function.
 * @param opts - Optional call ID and field overrides.
 * @returns A record representing the minimal POST data for function execution.
 */
export function generateMinimalPostData(
  fnName: string,
  args?: Record<string, unknown>,
  opts?: { callId?: string; overrides?: Record<string, unknown> },
): Record<string, unknown> {
  const data: Record<string, unknown> = {
    function: fnName,
    argument: args ?? {},
    call_id: opts?.callId ?? randomUuid(),
    call_type: 'webrtc',
    call_direction: 'inbound',
    caller_id_name: 'CLI Test',
    caller_id_number: '+15551234567',
    from: '+15551234567',
    to: 'test-agent',
  };

  if (opts?.overrides) {
    Object.assign(data, opts.overrides);
  }

  return data;
}
