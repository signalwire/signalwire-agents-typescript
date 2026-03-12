/**
 * REST Example: Deploy a voice application with SWML scripts and call flows.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-fabric-swml-and-callflows.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // 1. Create a SWML script
  console.log('Creating SWML script...');
  const swml = await client.fabric.swmlScripts.create({
    name: 'Greeting Script',
    contents: { sections: { main: [{ play: { url: 'say:Hello from SignalWire' } }] } },
  });
  const swmlId = swml.id;
  console.log(`  Created SWML script: ${swmlId}`);

  // 2. List SWML scripts to confirm
  console.log('\nListing SWML scripts...');
  const scripts = await client.fabric.swmlScripts.list();
  for (const s of scripts.data ?? []) {
    console.log(`  - ${s.id}: ${s.display_name ?? 'unnamed'}`);
  }

  // 3. Create a call flow
  console.log('\nCreating call flow...');
  const flow = await client.fabric.callFlows.create({ title: 'Main IVR Flow' });
  const flowId = flow.id;
  console.log(`  Created call flow: ${flowId}`);

  // 4. Deploy a version of the call flow
  console.log('\nDeploying call flow version...');
  try {
    const version = await client.fabric.callFlows.deployVersion(flowId, { label: 'v1' });
    console.log(`  Deployed version: ${JSON.stringify(version)}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Deploy failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 5. List call flow versions
  console.log('\nListing call flow versions...');
  try {
    const versions = await client.fabric.callFlows.listVersions(flowId);
    for (const v of versions.data ?? []) {
      console.log(`  - Version: ${v.label ?? v.id ?? 'unknown'}`);
    }
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  List versions failed: ${err.statusCode}`);
    } else throw err;
  }

  // 6. List addresses for the call flow
  console.log('\nListing call flow addresses...');
  try {
    const addrs = await client.fabric.callFlows.listAddresses(flowId);
    for (const a of addrs.data ?? []) {
      console.log(`  - ${a.display_name ?? a.id ?? 'unknown'}`);
    }
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  List addresses failed: ${err.statusCode}`);
    } else throw err;
  }

  // 7. Create a SWML webhook as an alternative approach
  console.log('\nCreating SWML webhook...');
  const webhook = await client.fabric.swmlWebhooks.create({
    name: 'External Handler',
    primary_request_url: 'https://example.com/swml-handler',
  });
  const webhookId = webhook.id;
  console.log(`  Created webhook: ${webhookId}`);

  // 8. Clean up
  console.log('\nCleaning up...');
  await client.fabric.swmlWebhooks.delete(webhookId);
  console.log(`  Deleted webhook ${webhookId}`);
  await client.fabric.callFlows.delete(flowId);
  console.log(`  Deleted call flow ${flowId}`);
  await client.fabric.swmlScripts.delete(swmlId);
  console.log(`  Deleted SWML script ${swmlId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
