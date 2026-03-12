/**
 * REST Example: Conference infrastructure, cXML resources, generic routing, and tokens.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-fabric-conferences-and-routing.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // 1. Create a conference room
  console.log('Creating conference room...');
  const room = await client.fabric.conferenceRooms.create({ name: 'team-standup' });
  const roomId = room.id;
  console.log(`  Created conference room: ${roomId}`);

  // 2. List conference room addresses
  console.log('\nListing conference room addresses...');
  try {
    const addrs = await client.fabric.conferenceRooms.listAddresses(roomId);
    for (const a of addrs.data ?? []) {
      console.log(`  - ${a.display_name ?? a.id ?? 'unknown'}`);
    }
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  List addresses failed: ${err.statusCode}`);
    } else throw err;
  }

  // 3. Create a cXML script
  console.log('\nCreating cXML script...');
  const cxml = await client.fabric.cxmlScripts.create({
    name: 'Hold Music Script',
    contents: '<Response><Say>Please hold.</Say><Play>https://example.com/hold.mp3</Play></Response>',
  });
  const cxmlId = cxml.id;
  console.log(`  Created cXML script: ${cxmlId}`);

  // 4. Create a cXML webhook
  console.log('\nCreating cXML webhook...');
  const cxmlWh = await client.fabric.cxmlWebhooks.create({
    name: 'External cXML Handler',
    primary_request_url: 'https://example.com/cxml-handler',
  });
  const cxmlWhId = cxmlWh.id;
  console.log(`  Created cXML webhook: ${cxmlWhId}`);

  // 5. Create a relay application
  console.log('\nCreating relay application...');
  const relayApp = await client.fabric.relayApplications.create({
    name: 'Inbound Handler',
    topic: 'office',
  });
  const relayId = relayApp.id;
  console.log(`  Created relay application: ${relayId}`);

  // 6. Generic resources: list all
  console.log('\nListing all fabric resources...');
  const resources = await client.fabric.resources.list();
  for (const r of (resources.data ?? []).slice(0, 5)) {
    console.log(`  - ${r.type ?? 'unknown'}: ${r.display_name ?? r.id ?? 'unknown'}`);
  }

  // 7. Get a specific generic resource
  const first = (resources.data ?? [{}])[0];
  if (first?.id) {
    const detail = await client.fabric.resources.get(first.id);
    console.log(`  Resource detail: ${detail.display_name ?? 'N/A'} (${detail.type ?? 'N/A'})`);
  }

  // 8. Assign a phone route to a resource (demo)
  console.log('\nAssigning phone route (demo)...');
  try {
    await client.fabric.resources.assignPhoneRoute(relayId, { phone_number: '+15551234567' });
    console.log('  Phone route assigned');
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Route assignment failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 9. Assign a domain application (demo)
  console.log('\nAssigning domain application (demo)...');
  try {
    await client.fabric.resources.assignDomainApplication(relayId, { domain: 'app.example.com' });
    console.log('  Domain application assigned');
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Domain assignment failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 10. Generate tokens
  console.log('\nGenerating tokens...');
  try {
    const guest = await client.fabric.tokens.createGuestToken({ resource_id: relayId });
    console.log(`  Guest token: ${String(guest.token ?? '').slice(0, 40)}...`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Guest token failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  try {
    const invite = await client.fabric.tokens.createInviteToken({ resource_id: relayId });
    console.log(`  Invite token: ${String(invite.token ?? '').slice(0, 40)}...`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Invite token failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  try {
    const embed = await client.fabric.tokens.createEmbedToken({ resource_id: relayId });
    console.log(`  Embed token: ${String(embed.token ?? '').slice(0, 40)}...`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Embed token failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 11. Clean up
  console.log('\nCleaning up...');
  await client.fabric.relayApplications.delete(relayId);
  console.log(`  Deleted relay application ${relayId}`);
  await client.fabric.cxmlWebhooks.delete(cxmlWhId);
  console.log(`  Deleted cXML webhook ${cxmlWhId}`);
  await client.fabric.cxmlScripts.delete(cxmlId);
  console.log(`  Deleted cXML script ${cxmlId}`);
  await client.fabric.conferenceRooms.delete(roomId);
  console.log(`  Deleted conference room ${roomId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
