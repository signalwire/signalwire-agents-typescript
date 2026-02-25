/**
 * Verb Methods Example
 *
 * Demonstrates SwmlBuilder's auto-vivified verb methods for
 * building SWML call flows with fluent chaining.
 * Run: npx tsx examples/verb-methods.ts
 */

import { AgentBase, SwmlBuilder } from '../src/index.js';

export const agent = new AgentBase({
  name: 'verb-demo',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText('You are a helpful assistant.');
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

// Use SwmlBuilder verb methods to control the call flow
// Phase 1: Pre-answer — play ringing
agent.addPreAnswerVerb('play', { urls: ['ring:us'], auto_answer: false });

// Phase 3: Post-answer — play a welcome message, then a short pause
agent.addPostAnswerVerb('play', {
  url: 'say:Welcome! Please hold while I connect you.',
});
agent.addPostAnswerVerb('sleep', 1);

// Phase 5: Post-AI — hangup after the AI conversation
agent.addPostAiVerb('hangup', {});

// You can also build standalone SWML documents with SwmlBuilder directly:
const ivr = new SwmlBuilder();
ivr.addVerb('answer', { max_duration: 300 });
ivr.addVerb('play', { url: 'say:Hello from the SWML builder!' });
ivr.addVerb('sleep', 2);
ivr.addVerb('hangup', {});

console.log('Standalone SWML:', JSON.stringify(ivr.getDocument(), null, 2));

agent.run();
