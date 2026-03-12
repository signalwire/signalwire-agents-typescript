/**
 * RELAY Outbound Call Example
 *
 * Dials an outbound call, detects answering machine, and plays a message.
 *
 * Required env vars:
 *   SIGNALWIRE_PROJECT_ID - Your SignalWire project ID
 *   SIGNALWIRE_TOKEN      - Your SignalWire API token
 *   SIGNALWIRE_SPACE      - Your SignalWire space (e.g. example.signalwire.com)
 *   DIAL_TO               - Destination number in E.164 format
 *   DIAL_FROM             - Caller ID number in E.164 format
 *
 * Usage:
 *   DIAL_TO=+15551234567 DIAL_FROM=+15559876543 npx tsx relay/examples/relay-outbound.ts
 */

import { RelayClient, RelayError } from '../../src/relay/index.js';

const to = process.env.DIAL_TO;
const from = process.env.DIAL_FROM;

if (!to || !from) {
  console.error('Set DIAL_TO and DIAL_FROM env vars');
  process.exit(1);
}

async function main() {
  const client = new RelayClient({ contexts: ['default'] });

  try {
    await client.connect();
    console.log('Connected to RELAY');

    // Dial outbound
    console.log(`Dialing ${to} from ${from}...`);
    const call = await client.dial(
      [[{ type: 'phone', to, from }]],
      { dialTimeout: 30_000 },
    );
    console.log(`Call answered! call_id=${call.callId}`);

    // Detect answering machine
    const detectAction = await call.detect(
      { type: 'machine', params: { initial_timeout: 5 } },
      { timeout: 10 },
    );

    const detectEvent = await detectAction.wait(15_000);
    const detect = detectEvent.params.detect as Record<string, unknown> | undefined;
    const machineEvent = (detect?.params as Record<string, unknown>)?.event ?? 'unknown';
    console.log(`Detection result: ${machineEvent}`);

    // Play message
    const playAction = await call.play([
      { type: 'tts', text: 'This is an automated message from SignalWire. Have a great day!' },
    ]);
    await playAction.wait();
    console.log('Message played');

    // Hang up
    await call.hangup();
    console.log('Call ended');

    await client.disconnect();
  } catch (err) {
    if (err instanceof RelayError) {
      console.error(`RELAY error: ${err.message} (code=${err.code})`);
    } else {
      console.error(`Error: ${err}`);
    }
    await client.disconnect();
    process.exit(1);
  }
}

main();
