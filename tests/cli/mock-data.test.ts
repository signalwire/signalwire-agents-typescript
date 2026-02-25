import { describe, it, expect } from 'vitest';
import { generateFakePostData, generateMinimalPostData } from '../../src/cli/mock-data.js';

describe('mock-data', () => {
  describe('generateFakePostData', () => {
    it('generates data with defaults', () => {
      const data = generateFakePostData();
      expect(data.call_id).toBeDefined();
      expect(data.call_type).toBe('webrtc');
      expect(data.call_direction).toBe('inbound');
      expect(data.caller_id_number).toBe('+15551234567');
      expect(data.channel_type).toBe('web');
    });

    it('generates SIP call data', () => {
      const data = generateFakePostData({ callType: 'sip' });
      expect(data.call_type).toBe('sip');
      expect(data.channel_type).toBe('phone');
      expect(data.sip_headers).toBeDefined();
    });

    it('respects custom options', () => {
      const data = generateFakePostData({
        callType: 'sip',
        callDirection: 'outbound',
        fromNumber: '+18005551212',
        toExtension: 'my-agent',
      });
      expect(data.call_type).toBe('sip');
      expect(data.call_direction).toBe('outbound');
      expect(data.from).toBe('+18005551212');
      expect(data.to).toBe('my-agent');
    });

    it('generates unique call IDs', () => {
      const data1 = generateFakePostData();
      const data2 = generateFakePostData();
      expect(data1.call_id).not.toBe(data2.call_id);
    });

    it('webrtc calls have no sip_headers', () => {
      const data = generateFakePostData({ callType: 'webrtc' });
      expect(data.sip_headers).toBeUndefined();
    });
  });

  describe('generateMinimalPostData', () => {
    it('generates minimal data for function execution', () => {
      const data = generateMinimalPostData('get_time');
      expect(data.function).toBe('get_time');
      expect(data.argument).toEqual({});
      expect(data.call_id).toBeDefined();
    });

    it('includes provided arguments', () => {
      const data = generateMinimalPostData('search', { query: 'test' });
      expect(data.function).toBe('search');
      expect(data.argument).toEqual({ query: 'test' });
    });

    it('generates unique call IDs each time', () => {
      const data1 = generateMinimalPostData('fn');
      const data2 = generateMinimalPostData('fn');
      expect(data1.call_id).not.toBe(data2.call_id);
    });

    it('accepts callId override', () => {
      const data = generateMinimalPostData('fn', {}, { callId: 'my-call-id' });
      expect(data.call_id).toBe('my-call-id');
    });

    it('accepts overrides', () => {
      const data = generateMinimalPostData('fn', {}, { overrides: { custom_field: 'custom_value' } });
      expect(data['custom_field']).toBe('custom_value');
    });
  });

  describe('generateFakePostData - extended', () => {
    it('includes call_state', () => {
      const data = generateFakePostData({ callState: 'ringing' });
      expect(data.call_state).toBe('ringing');
    });

    it('accepts callId override', () => {
      const data = generateFakePostData({ callId: 'fixed-call-id' });
      expect(data.call_id).toBe('fixed-call-id');
    });

    it('applies overrides to post data', () => {
      const data = generateFakePostData({ overrides: { custom: 'value' } });
      expect(data['custom']).toBe('value');
    });
  });
});
