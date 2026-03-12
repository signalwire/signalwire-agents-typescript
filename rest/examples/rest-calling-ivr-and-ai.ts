/**
 * REST Example: IVR input collection, AI operations, and advanced call control.
 *
 * NOTE: These commands require an active call. The CALL_ID used here is
 * illustrative -- in production you would obtain it from a dial response or
 * inbound call event.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-calling-ivr-and-ai.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();
const CALL_ID = 'demo-call-id';

async function safe(label: string, fn: () => Promise<unknown>): Promise<unknown> {
  try {
    const result = await fn();
    console.log(`  ${label}: OK`);
    return result;
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  ${label}: failed (${err.statusCode})`);
    } else throw err;
    return null;
  }
}

async function main() {
  // 1. Collect DTMF input
  console.log('Collecting DTMF input...');
  await safe('Collect', () => client.calling.collect(CALL_ID, {
    digits: { max: 4, terminators: '#' },
    play: [{ type: 'tts', text: 'Enter your PIN followed by pound.' }],
  }));
  await safe('Start input timers', () => client.calling.collectStartInputTimers(CALL_ID));
  await safe('Stop collect', () => client.calling.collectStop(CALL_ID));

  // 2. Answering machine detection
  console.log('\nDetecting answering machine...');
  await safe('Detect', () => client.calling.detect(CALL_ID, { type: 'machine' }));
  await safe('Stop detect', () => client.calling.detectStop(CALL_ID));

  // 3. AI operations
  console.log('\nAI agent operations...');
  await safe('AI message', () => client.calling.aiMessage(CALL_ID, {
    message: 'The customer wants to check their balance.',
  }));
  await safe('AI hold', () => client.calling.aiHold(CALL_ID));
  await safe('AI unhold', () => client.calling.aiUnhold(CALL_ID));
  await safe('AI stop', () => client.calling.aiStop(CALL_ID));

  // 4. Live transcription and translation
  console.log('\nLive transcription and translation...');
  await safe('Live transcribe', () => client.calling.liveTranscribe(CALL_ID, { language: 'en-US' }));
  await safe('Live translate', () => client.calling.liveTranslate(CALL_ID, { language: 'es' }));

  // 5. Tap (media fork)
  console.log('\nTap (media fork)...');
  await safe('Tap start', () => client.calling.tap(CALL_ID, {
    tap: { type: 'audio', direction: 'both' },
    device: { type: 'rtp', addr: '192.168.1.100', port: 9000 },
  }));
  await safe('Tap stop', () => client.calling.tapStop(CALL_ID));

  // 6. Stream (WebSocket)
  console.log('\nStream (WebSocket)...');
  await safe('Stream start', () => client.calling.stream(CALL_ID, { url: 'wss://example.com/audio-stream' }));
  await safe('Stream stop', () => client.calling.streamStop(CALL_ID));

  // 7. User event
  console.log('\nSending user event...');
  await safe('User event', () => client.calling.userEvent(CALL_ID, {
    event_name: 'agent_note', data: { note: 'VIP caller' },
  }));

  // 8. SIP refer
  console.log('\nSIP refer...');
  await safe('SIP refer', () => client.calling.refer(CALL_ID, { sip_uri: 'sip:support@example.com' }));

  // 9. Fax stop commands
  console.log('\nFax stop commands...');
  await safe('Send fax stop', () => client.calling.sendFaxStop(CALL_ID));
  await safe('Receive fax stop', () => client.calling.receiveFaxStop(CALL_ID));

  // 10. Transfer and disconnect
  console.log('\nTransfer and disconnect...');
  await safe('Transfer', () => client.calling.transfer(CALL_ID, { dest: '+15559999999' }));
  await safe('Update call', () => client.calling.update({ call_id: CALL_ID, metadata: { priority: 'high' } }));
  await safe('Disconnect', () => client.calling.disconnect(CALL_ID));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
