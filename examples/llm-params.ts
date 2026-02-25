/**
 * LLM Parameters Example
 *
 * Fine-tune AI behavior: temperature, top_p, barge confidence,
 * speech recognition hints, fillers, and post-prompt instructions.
 * Run: npx tsx examples/llm-params.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'tuned-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a precise, factual assistant for a medical office. ' +
  'Always confirm information before proceeding. Never guess or speculate.',
);

// LLM parameters — low temperature for precision
agent.setParams({
  temperature: 0.2,
  top_p: 0.9,
  confidence: 0.6,
  barge_confidence: 0.3,
  barge_match_string: 'stop,cancel,hold on',
  attention_timeout: 15000,
  inactivity_timeout: 20000,
  background_file_loops: -1,
  background_file_volume: 10,
});

// Language with function-level fillers
agent.addLanguage({
  name: 'English',
  code: 'en-US',
  voice: 'rachel',
  fillers: ['one moment please', 'let me check that for you', 'just a second'],
  functionFillers: ['looking that up now', 'searching our records'],
});

// Post-prompt for structured call summary
agent.setPostPrompt(
  'Summarize this call as JSON with fields: patient_name, appointment_type, date_requested, special_instructions.',
);

// Speech recognition hints for medical terms
agent.addHints(['appointment', 'prescription', 'referral', 'lab results', 'follow-up']);
agent.addPronunciation({ replace: 'Dr.', with: 'Doctor' });

agent.defineTool({
  name: 'check_availability',
  description: 'Check appointment availability for a given date',
  parameters: {
    date: { type: 'string', description: 'The requested date (YYYY-MM-DD)' },
  },
  handler: (args) => {
    return new SwaigFunctionResult(
      `Availability for ${args.date}: 9:00 AM, 11:30 AM, 2:00 PM slots open.`,
    );
  },
});

agent.run();
