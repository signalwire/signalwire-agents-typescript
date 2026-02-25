/**
 * SWML Service Example
 *
 * A non-AI SWML service that builds IVR call flows without an AI block.
 * Uses SWMLService instead of AgentBase for pure call-flow control.
 * Run: npx tsx examples/swml-service.ts
 */

import { SWMLService, SwmlBuilder } from '../src/index.js';

export const agent = new SWMLService({
  name: 'ivr-menu',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

// Build a simple IVR: answer → play greeting → record voicemail → hangup
agent.addVerb('answer', { max_duration: 300 });
agent.addVerb('play', {
  url: 'say:Thank you for calling Acme Corp. All agents are currently busy. Please leave a message after the beep.',
});
agent.addVerb('record', {
  stereo: true,
  format: 'mp3',
  direction: 'both',
  terminators: '#',
  beep: true,
});
agent.addVerb('play', { url: 'say:Thank you. Goodbye!' });
agent.addVerb('hangup', {});

// Print the generated SWML
console.log('SWML Document:', JSON.stringify(agent.renderSwml(), null, 2));

agent.run();
