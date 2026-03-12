/**
 * REST Client Example — demonstrates CRUD operations, search, and pagination.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-client.ts
 */

import { SignalWireClient, paginateAll } from '../../src/index.js';

async function main() {
  // Create client — reads from env vars if not provided explicitly
  const client = new SignalWireClient();

  console.log('=== Phone Numbers ===');

  // List owned phone numbers
  const numbers = await client.phoneNumbers.list();
  console.log('Owned numbers:', numbers.data?.length ?? 0);

  // Search available numbers
  const available = await client.phoneNumbers.search({ area_code: '512' });
  console.log('Available 512 numbers:', available.data?.length ?? 0);

  console.log('\n=== Fabric AI Agents ===');

  // List AI agents
  const agents = await client.fabric.aiAgents.list();
  console.log('AI agents:', agents.data?.length ?? 0);

  console.log('\n=== Video Rooms ===');

  // List video rooms
  const rooms = await client.video.rooms.list();
  console.log('Video rooms:', rooms.data?.length ?? 0);

  console.log('\n=== Datasphere ===');

  // List documents
  const docs = await client.datasphere.documents.list();
  console.log('Documents:', docs.data?.length ?? 0);

  console.log('\n=== Logs ===');

  // List recent voice logs
  const voiceLogs = await client.logs.voice.list({ page_size: 5 });
  console.log('Recent voice logs:', voiceLogs.data?.length ?? 0);

  console.log('\n=== Compat (Twilio-compatible) ===');

  // List calls via compatibility API
  const calls = await client.compat.calls.list();
  console.log('Compat calls:', calls.calls?.length ?? 0);

  console.log('\nDone.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
