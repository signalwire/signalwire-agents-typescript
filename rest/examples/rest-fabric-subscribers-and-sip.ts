/**
 * REST Example: Provision a SIP-enabled user on Fabric.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-fabric-subscribers-and-sip.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // 1. Create a subscriber
  console.log('Creating subscriber...');
  const subscriber: any = await client.fabric.subscribers.create({
    name: 'Alice Johnson',
    email: 'alice@example.com',
  });
  const subId = subscriber.id;
  const innerSubId = subscriber.subscriber?.id ?? subId;
  console.log(`  Created subscriber: ${subId}`);

  // 2. Add a SIP endpoint to the subscriber
  console.log('\nCreating SIP endpoint on subscriber...');
  const endpoint = await client.fabric.subscribers.createSipEndpoint(subId, {
    username: 'alice_sip',
    password: 'SecurePass123!',
  });
  const epId = endpoint.id;
  console.log(`  Created SIP endpoint: ${epId}`);

  // 3. List SIP endpoints on the subscriber
  console.log('\nListing subscriber SIP endpoints...');
  const endpoints = await client.fabric.subscribers.listSipEndpoints(subId);
  for (const ep of endpoints.data ?? []) {
    console.log(`  - ${ep.id}: ${ep.username ?? 'unknown'}`);
  }

  // 4. Get specific SIP endpoint details
  console.log(`\nGetting SIP endpoint ${epId}...`);
  const epDetail = await client.fabric.subscribers.getSipEndpoint(subId, epId);
  console.log(`  Username: ${epDetail.username ?? 'N/A'}`);

  // 5. Create a standalone SIP gateway
  console.log('\nCreating SIP gateway...');
  const gateway = await client.fabric.sipGateways.create({
    name: 'Office PBX Gateway',
    uri: 'sip:pbx.example.com',
    encryption: 'required',
    ciphers: ['AES_256_CM_HMAC_SHA1_80'],
    codecs: ['PCMU', 'PCMA'],
  });
  const gwId = gateway.id;
  console.log(`  Created SIP gateway: ${gwId}`);

  // 6. List fabric addresses
  console.log('\nListing fabric addresses...');
  try {
    const addresses = await client.fabric.addresses.list();
    for (const addr of (addresses.data ?? []).slice(0, 5)) {
      console.log(`  - ${addr.display_name ?? addr.id ?? 'unknown'}`);
    }

    // 7. Get a specific fabric address
    const firstAddr = (addresses.data ?? [{}])[0];
    if (firstAddr?.id) {
      const addrDetail = await client.fabric.addresses.get(firstAddr.id);
      console.log(`  Address detail: ${addrDetail.display_name ?? 'N/A'}`);
    }
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Fabric addresses failed: ${err.statusCode}`);
    } else throw err;
  }

  // 8. Generate a subscriber token
  console.log('\nGenerating subscriber token...');
  try {
    const token = await client.fabric.tokens.createSubscriberToken({
      subscriber_id: innerSubId,
      reference: innerSubId,
    });
    console.log(`  Token: ${String(token.token ?? '').slice(0, 40)}...`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Token generation failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 9. Clean up
  console.log('\nCleaning up...');
  await client.fabric.subscribers.deleteSipEndpoint(subId, epId);
  console.log(`  Deleted SIP endpoint ${epId}`);
  await client.fabric.subscribers.delete(subId);
  console.log(`  Deleted subscriber ${subId}`);
  await client.fabric.sipGateways.delete(gwId);
  console.log(`  Deleted SIP gateway ${gwId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
