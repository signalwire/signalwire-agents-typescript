/**
 * REST Example: Call queues, recording review, and MFA verification.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-queues-mfa-and-recordings.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // --- Queues ---

  // 1. Create a queue
  console.log('Creating call queue...');
  let queueId: string | null = null;
  try {
    const queue = await client.queues.create({ name: 'Support Queue', max_size: 50 });
    queueId = queue.id;
    console.log(`  Created queue: ${queueId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Queue creation failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 2. List queues
  console.log('\nListing queues...');
  const queues = await client.queues.list();
  for (const q of queues.data ?? []) {
    console.log(`  - ${q.id}: ${q.friendly_name ?? q.name ?? 'unnamed'}`);
  }

  // 3. Get and update queue
  if (queueId) {
    const detail = await client.queues.get(queueId);
    console.log(`\nQueue detail: ${detail.friendly_name ?? 'N/A'} (max: ${detail.max_size ?? 'N/A'})`);

    await client.queues.update(queueId, { name: 'Priority Support Queue' });
    console.log('  Updated queue name');
  }

  // 4. Queue members
  if (queueId) {
    console.log('\nListing queue members...');
    try {
      const members = await client.queues.listMembers(queueId);
      for (const m of members.data ?? []) {
        console.log(`  - Member: ${m.call_id ?? m.id ?? 'unknown'}`);
      }

      const nextMember = await client.queues.getNextMember(queueId);
      console.log(`  Next member: ${JSON.stringify(nextMember)}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Member ops failed (expected if queue empty): ${err.statusCode}`);
      } else throw err;
    }
  }

  // --- Recordings ---

  // 5. List recordings
  console.log('\nListing recordings...');
  const recordings = await client.recordings.list();
  for (const r of (recordings.data ?? []).slice(0, 5)) {
    console.log(`  - ${r.id}: ${r.duration ?? 'N/A'}s`);
  }

  // 6. Get recording details
  const firstRec = (recordings.data ?? [{}])[0];
  if (firstRec?.id) {
    const recDetail = await client.recordings.get(firstRec.id);
    console.log(`  Recording: ${recDetail.duration ?? 'N/A'}s, ${recDetail.format ?? 'N/A'}`);
  }

  // --- MFA ---

  // 7. Send MFA via SMS
  console.log('\nSending MFA SMS code...');
  let requestId: string | null = null;
  try {
    const smsResult = await client.mfa.sms({
      to: '+15551234567',
      from: '+15559876543',
      message: 'Your code is {{code}}',
      token_length: 6,
    });
    requestId = smsResult.id ?? smsResult.request_id ?? null;
    console.log(`  MFA SMS sent: ${requestId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  MFA SMS failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 8. Send MFA via voice call
  console.log('\nSending MFA voice code...');
  try {
    const voiceResult = await client.mfa.call({
      to: '+15551234567',
      from: '+15559876543',
      message: 'Your verification code is {{code}}',
      token_length: 6,
    });
    console.log(`  MFA call sent: ${voiceResult.id ?? voiceResult.request_id}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  MFA call failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 9. Verify MFA token
  if (requestId) {
    console.log('\nVerifying MFA token...');
    try {
      const verify = await client.mfa.verify(requestId, { token: '123456' });
      console.log(`  Verification result: ${JSON.stringify(verify)}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Verify failed (expected in demo): ${err.statusCode}`);
      } else throw err;
    }
  }

  // 10. Clean up
  console.log('\nCleaning up...');
  if (queueId) {
    await client.queues.delete(queueId);
    console.log(`  Deleted queue ${queueId}`);
  }
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
