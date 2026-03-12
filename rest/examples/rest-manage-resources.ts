/**
 * REST Example: Create an AI agent, assign a phone number, and place a test call.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-manage-resources.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // 1. Create an AI agent
  console.log('Creating AI agent...');
  const agent = await client.fabric.aiAgents.create({
    name: 'Demo Support Bot',
    prompt: { text: 'You are a friendly support agent for Acme Corp.' },
  });
  const agentId = agent.id;
  console.log(`  Created agent: ${agentId}`);

  // 2. List all AI agents
  console.log('\nListing AI agents...');
  const agents = await client.fabric.aiAgents.list();
  for (const a of agents.data ?? []) {
    console.log(`  - ${a.id}: ${a.name ?? 'unnamed'}`);
  }

  // 3. Search for a phone number
  console.log('\nSearching for available phone numbers...');
  const available = await client.phoneNumbers.search({ area_code: '512', max_results: 3 });
  for (const num of available.data ?? []) {
    console.log(`  - ${num.e164 ?? num.number ?? 'unknown'}`);
  }

  // 4. Place a test call (requires valid numbers)
  console.log('\nPlacing a test call...');
  try {
    const result = await client.calling.dial({
      from: '+15559876543',
      to: '+15551234567',
      url: 'https://example.com/call-handler',
    });
    console.log(`  Call initiated: ${JSON.stringify(result)}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Call failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 5. Clean up: delete the agent
  console.log(`\nDeleting agent ${agentId}...`);
  await client.fabric.aiAgents.delete(agentId);
  console.log('  Deleted.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
