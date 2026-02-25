/**
 * Simple Agent Example
 *
 * A minimal AI voice agent that answers calls and responds to questions.
 * Run: npx tsx examples/simple-agent.ts
 * Test: curl http://user:pass@localhost:3000/
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'simple-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText('You are a friendly assistant named Siggy. Help callers with their questions.');

agent.addHints(['SignalWire', 'SWML', 'Siggy']);
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

// Define a tool the AI can call
agent.defineTool({
  name: 'get_time',
  description: 'Get the current date and time',
  parameters: {},
  handler: () => {
    const now = new Date().toLocaleString();
    return new SwaigFunctionResult(`The current date and time is ${now}`);
  },
});

agent.run();
