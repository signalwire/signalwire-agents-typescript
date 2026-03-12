/**
 * REST Example: Control an active call with media operations (play, record, transcribe, denoise).
 *
 * NOTE: These commands require an active call. The call_id used here is
 * illustrative -- in production you would obtain it from a dial response or
 * inbound call event.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-calling-play-and-record.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

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
  // 1. Dial an outbound call
  console.log('Dialing outbound call...');
  let callId = 'demo-call-id';
  try {
    const call: any = await client.calling.dial({
      from: '+15559876543',
      to: '+15551234567',
      url: 'https://example.com/call-handler',
    });
    callId = call.id ?? 'demo-call-id';
    console.log(`  Call initiated: ${callId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Dial failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 2. Play TTS audio
  console.log('\nPlaying TTS on call...');
  await safe('Play', () => client.calling.play(callId, { play: [{ type: 'tts', text: 'Welcome to SignalWire.' }] }));

  // 3. Pause, resume, adjust volume, stop playback
  console.log('\nControlling playback...');
  await safe('Pause', () => client.calling.playPause(callId));
  await safe('Resume', () => client.calling.playResume(callId));
  await safe('Volume +2dB', () => client.calling.playVolume(callId, { volume: 2.0 }));
  await safe('Stop', () => client.calling.playStop(callId));

  // 4. Record the call
  console.log('\nRecording call...');
  await safe('Record', () => client.calling.record(callId, { beep: true, format: 'mp3' }));

  // 5. Pause, resume, stop recording
  console.log('\nControlling recording...');
  await safe('Pause', () => client.calling.recordPause(callId));
  await safe('Resume', () => client.calling.recordResume(callId));
  await safe('Stop', () => client.calling.recordStop(callId));

  // 6. Transcribe the call
  console.log('\nTranscribing call...');
  await safe('Transcribe', () => client.calling.transcribe(callId, { language: 'en-US' }));
  await safe('Transcribe stop', () => client.calling.transcribeStop(callId));

  // 7. Denoise the call
  console.log('\nEnabling denoise...');
  await safe('Denoise', () => client.calling.denoise(callId));
  await safe('Denoise stop', () => client.calling.denoiseStop(callId));

  // 8. End the call
  console.log('\nEnding call...');
  await safe('End', () => client.calling.end(callId, { reason: 'hangup' }));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
