/**
 * Mock call data generation for swaig-test CLI.
 */

import { randomBytes } from 'node:crypto';

export interface MockCallOptions {
  callType?: 'sip' | 'webrtc';
  callDirection?: 'inbound' | 'outbound';
  callState?: string;
  callId?: string;
  fromNumber?: string;
  toExtension?: string;
  overrides?: Record<string, unknown>;
}

function randomId(): string {
  return randomBytes(16).toString('hex');
}

function randomUuid(): string {
  const hex = randomBytes(16).toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

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
