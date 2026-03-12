/**
 * RELAY Inbound Call Example
 *
 * Answers inbound calls, plays a TTS greeting, collects digits, and hangs up.
 *
 * Required env vars:
 *   SIGNALWIRE_PROJECT_ID - Your SignalWire project ID
 *   SIGNALWIRE_TOKEN      - Your SignalWire API token
 *   SIGNALWIRE_SPACE      - Your SignalWire space (e.g. example.signalwire.com)
 *
 * Usage:
 *   npx tsx relay/examples/relay-inbound.ts
 */

import { RelayClient, Call, CALL_STATE_ENDED } from '../../src/relay/index.js';

const client = new RelayClient({
  contexts: ['office'],
});

client.onCall(async (call: Call) => {
  console.log(`Inbound call from ${JSON.stringify(call.device)}`);

  // Answer the call
  await call.answer();
  console.log('Call answered');

  // Play a greeting
  const playAction = await call.play([
    { type: 'tts', text: 'Hello! Welcome to the SignalWire RELAY demo.' },
  ]);
  await playAction.wait();
  console.log('Greeting played');

  // Collect digits
  const collectAction = await call.playAndCollect(
    [{ type: 'tts', text: 'Please enter your 4-digit PIN followed by the pound sign.' }],
    {
      digits: { max: 4, terminators: '#', digit_timeout: 5 },
      initial_timeout: 10,
    },
  );

  const collectEvent = await collectAction.wait();
  const result = collectEvent.params.result as Record<string, unknown> | undefined;
  if (result) {
    const digitParams = result.params as Record<string, unknown> | undefined;
    console.log(`Collected digits: ${digitParams?.digits ?? 'none'}`);

    await (await call.play([
      { type: 'tts', text: `You entered ${digitParams?.digits ?? 'nothing'}. Thank you!` },
    ])).wait();
  } else {
    await (await call.play([
      { type: 'tts', text: 'No input received. Goodbye!' },
    ])).wait();
  }

  // Hang up
  await call.hangup();
  console.log('Call ended');
});

console.log('Starting RELAY inbound call handler...');
console.log('Listening on context: office');
client.run();
