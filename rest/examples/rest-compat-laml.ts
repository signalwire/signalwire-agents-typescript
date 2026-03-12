/**
 * REST Example: Twilio-compatible LAML migration -- phone numbers, messaging,
 * calls, conferences, queues, recordings, project tokens, PubSub/Chat, and logs.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-compat-laml.ts
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
  // --- Compat Phone Numbers ---

  // 1. Search available numbers
  console.log('Searching compat phone numbers...');
  await safe('Search local', () => client.compat.phoneNumbers.searchLocal('US', { AreaCode: '512' }));
  await safe('Search toll-free', () => client.compat.phoneNumbers.searchTollFree('US'));
  await safe('List countries', () => client.compat.phoneNumbers.listAvailableCountries());

  // 2. Purchase a number (demo -- will fail without valid number)
  console.log('\nPurchasing compat number...');
  const num: any = await safe('Purchase', () => client.compat.phoneNumbers.purchase({ PhoneNumber: '+15125551234' }));
  const numSid = num?.sid ?? null;

  // --- LaML Bin & Application ---

  // 3. Create a LaML bin and application
  console.log('\nCreating LaML resources...');
  const laml: any = await safe('LaML bin', () => client.compat.lamlBins.create({
    Name: 'Hold Music',
    Contents: '<Response><Say>Please hold.</Say></Response>',
  }));
  const lamlSid = laml?.sid ?? null;

  const app: any = await safe('Application', () => client.compat.applications.create({
    FriendlyName: 'Demo App',
    VoiceUrl: 'https://example.com/voice',
  }));
  const appSid = app?.sid ?? null;

  // --- Messaging ---

  // 4. Send an SMS (demo -- requires valid numbers)
  console.log('\nMessaging operations...');
  const msg: any = await safe('Send SMS', () => client.compat.messages.create({
    From: '+15559876543', To: '+15551234567', Body: 'Hello from SignalWire!',
  }));
  const msgSid = msg?.sid ?? null;

  // 5. List and get messages
  await safe('List messages', () => client.compat.messages.list());
  if (msgSid) {
    await safe('Get message', () => client.compat.messages.get(msgSid));
    await safe('List media', () => client.compat.messages.listMedia(msgSid));
  }

  // --- Calls ---

  // 6. Outbound call with recording and streaming
  console.log('\nCall operations...');
  const call: any = await safe('Create call', () => client.compat.calls.create({
    From: '+15559876543', To: '+15551234567',
    Url: 'https://example.com/voice-handler',
  }));
  const callSid = call?.sid ?? null;

  if (callSid) {
    await safe('Start recording', () => client.compat.calls.startRecording(callSid));
    await safe('Start stream', () => client.compat.calls.startStream(callSid, { Url: 'wss://example.com/stream' }));
  }

  // --- Conferences ---

  // 7. Conference operations
  console.log('\nConference operations...');
  const confs: any = await safe('List conferences', () => client.compat.conferences.list());
  const confSid = confs?.data?.[0]?.sid ?? null;

  if (confSid) {
    await safe('Get conference', () => client.compat.conferences.get(confSid));
    await safe('List participants', () => client.compat.conferences.listParticipants(confSid));
    await safe('List conf recordings', () => client.compat.conferences.listRecordings(confSid));
  }

  // --- Queues ---

  // 8. Queue operations
  console.log('\nQueue operations...');
  const queue: any = await safe('Create queue', () => client.compat.queues.create({ FriendlyName: 'compat-support-queue' }));
  const qSid = queue?.sid ?? null;

  if (qSid) {
    await safe('List queue members', () => client.compat.queues.listMembers(qSid));
  }

  // --- Recordings & Transcriptions ---

  // 9. Recordings and transcriptions
  console.log('\nRecordings and transcriptions...');
  const recs: any = await safe('List recordings', () => client.compat.recordings.list());
  const firstRecSid = recs?.data?.[0]?.sid ?? null;
  if (firstRecSid) {
    await safe('Get recording', () => client.compat.recordings.get(firstRecSid));
  }

  const trans: any = await safe('List transcriptions', () => client.compat.transcriptions.list());
  const firstTransSid = trans?.data?.[0]?.sid ?? null;
  if (firstTransSid) {
    await safe('Get transcription', () => client.compat.transcriptions.get(firstTransSid));
  }

  // --- Faxes ---

  // 10. Fax operations
  console.log('\nFax operations...');
  const fax: any = await safe('Create fax', () => client.compat.faxes.create({
    From: '+15559876543', To: '+15551234567',
    MediaUrl: 'https://example.com/document.pdf',
  }));
  const faxSid = fax?.sid ?? null;
  if (faxSid) {
    await safe('Get fax', () => client.compat.faxes.get(faxSid));
  }

  // --- Compat Accounts & Tokens ---

  // 11. Accounts and compat tokens
  console.log('\nAccounts and compat tokens...');
  await safe('List accounts', () => client.compat.accounts.list());
  const compatToken: any = await safe('Create compat token', () => client.compat.tokens.create({ name: 'demo-token' }));
  if (compatToken?.id) {
    await safe('Delete compat token', () => client.compat.tokens.delete(compatToken.id));
  }

  // --- Project Tokens ---

  // 12. Project token management
  console.log('\nProject tokens...');
  const projToken: any = await safe('Create project token', () => client.project.tokens.create({
    name: 'CI Token',
    permissions: ['calling', 'messaging', 'video'],
  }));
  if (projToken?.id) {
    await safe('Update project token', () => client.project.tokens.update(projToken.id, { name: 'CI Token (updated)' }));
    await safe('Delete project token', () => client.project.tokens.delete(projToken.id));
  }

  // --- PubSub & Chat Tokens ---

  // 13. PubSub and Chat tokens
  console.log('\nPubSub and Chat tokens...');
  await safe('PubSub token', () => client.pubsub.createToken({
    channels: { notifications: { read: true, write: true } },
    ttl: 3600,
  }));
  await safe('Chat token', () => client.chat.createToken({
    member_id: 'user-alice',
    channels: { general: { read: true, write: true } },
    ttl: 3600,
  }));

  // --- Logs ---

  // 14. Log queries
  console.log('\nQuerying logs...');
  await safe('Message logs', () => client.logs.messages.list());
  await safe('Voice logs', () => client.logs.voice.list());
  await safe('Fax logs', () => client.logs.fax.list());
  await safe('Conference logs', () => client.logs.conferences.list());

  const voiceLogs: any = await safe('Voice log list', () => client.logs.voice.list()) ?? {};
  const firstVoice = (voiceLogs?.data ?? [{}])[0];
  if (firstVoice?.id) {
    await safe('Voice log detail', () => client.logs.voice.get(firstVoice.id));
    await safe('Voice log events', () => client.logs.voice.listEvents(firstVoice.id));
  }

  // --- Clean up ---

  console.log('\nCleaning up...');
  if (qSid) await safe('Delete queue', () => client.compat.queues.delete(qSid));
  if (appSid) await safe('Delete application', () => client.compat.applications.delete(appSid));
  if (lamlSid) await safe('Delete LaML bin', () => client.compat.lamlBins.delete(lamlSid));
  if (numSid) await safe('Delete number', () => client.compat.phoneNumbers.delete(numSid));
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
