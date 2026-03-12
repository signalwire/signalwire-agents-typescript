/**
 * RELAY Messaging Example
 *
 * Sends an outbound SMS and listens for inbound messages.
 *
 * Required env vars:
 *   SIGNALWIRE_PROJECT_ID - Your SignalWire project ID
 *   SIGNALWIRE_TOKEN      - Your SignalWire API token
 *   SIGNALWIRE_SPACE      - Your SignalWire space (e.g. example.signalwire.com)
 *   MSG_TO                - Destination number in E.164 format
 *   MSG_FROM              - Sender number in E.164 format (must be owned by your project)
 *
 * Usage:
 *   MSG_TO=+15551234567 MSG_FROM=+15559876543 npx tsx relay/examples/relay-messaging.ts
 */

import { RelayClient, Message } from '../../src/relay/index.js';

const to = process.env.MSG_TO;
const from = process.env.MSG_FROM;

if (!to || !from) {
  console.error('Set MSG_TO and MSG_FROM env vars');
  process.exit(1);
}

const client = new RelayClient({
  contexts: ['messaging'],
});

// Handle inbound messages
client.onMessage(async (message: Message) => {
  console.log(`Inbound message from ${message.fromNumber}: ${message.body}`);
  console.log(`  media: ${message.media.length > 0 ? message.media.join(', ') : 'none'}`);
});

async function sendAndWait() {
  await client.connect();
  console.log('Connected to RELAY');

  // Send outbound SMS
  console.log(`Sending SMS to ${to}...`);
  const message = await client.sendMessage({
    to,
    from,
    body: 'Hello from SignalWire RELAY TypeScript SDK!',
  });
  console.log(`Message queued: id=${message.messageId}`);

  // Track delivery
  message.on(async (event) => {
    console.log(`Message state: ${event.params.message_state}`);
  });

  try {
    const terminalEvent = await message.wait(30_000);
    console.log(`Final state: ${message.state}`);
    if (message.reason) {
      console.log(`Reason: ${message.reason}`);
    }
  } catch (err) {
    console.error(`Message tracking error: ${err}`);
  }

  console.log('Now listening for inbound messages... (Ctrl+C to stop)');
}

sendAndWait().catch(console.error);

// Keep running to receive inbound messages
client.run();
