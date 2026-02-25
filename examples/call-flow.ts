/**
 * Call Flow Verbs Example
 *
 * Control what happens before, during, and after the AI conversation
 * using SWML verbs in the 5-phase rendering pipeline.
 * Run: npx tsx examples/call-flow.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'call-flow-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
  recordCall: true,       // Record the call (Phase 3)
  recordFormat: 'mp4',
  recordStereo: true,
});

agent.setPromptText('You are a receptionist. Help callers schedule appointments.');

// Phase 1: Play ringing before answering
agent.addPreAnswerVerb('play', {
  urls: ['ring:us'],
  auto_answer: false,
});

// Phase 3: Play a welcome message after answering but before the AI takes over
agent.addPostAnswerVerb('play', {
  url: 'say:Welcome to Acme Corp. Please hold while I connect you with our AI assistant.',
});

// Phase 5: Hangup after the AI conversation ends
agent.addPostAiVerb('hangup', {});

// AI config
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
agent.addPronunciation({ replace: 'Acme', with: 'Ak-mee' });
agent.setParam('temperature', 0.7);

// Post-prompt for call summary
agent.setPostPrompt('Provide a JSON summary with: caller_name, appointment_date, appointment_reason');

// Tool for scheduling
agent.defineTool({
  name: 'schedule_appointment',
  description: 'Schedule an appointment for the caller',
  parameters: {
    date: { type: 'string', description: 'Appointment date (YYYY-MM-DD)' },
    time: { type: 'string', description: 'Appointment time (HH:MM)' },
    reason: { type: 'string', description: 'Reason for the appointment' },
  },
  handler: (args) => {
    return new SwaigFunctionResult(
      `Appointment scheduled for ${args.date} at ${args.time}. Reason: ${args.reason}`,
    );
  },
});

agent.run();
