/**
 * POM (Prompt Object Model) Example
 *
 * Build structured prompts with sections, bullets, and subsections
 * instead of raw text strings.
 * Run: npx tsx examples/pom-prompt.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'support-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

// Build a structured prompt with POM
agent.promptAddSection('Role', {
  body: 'You are a technical support agent for Acme Corp.',
});

agent.promptAddSection('Capabilities', {
  bullets: [
    'Answer questions about our products',
    'Help troubleshoot common issues',
    'Escalate complex problems to human agents',
  ],
});

agent.promptAddSection('Guidelines', {
  body: 'Always follow these rules when assisting customers:',
  subsections: [
    {
      title: 'Tone',
      body: 'Be professional, empathetic, and patient.',
    },
    {
      title: 'Escalation',
      body: 'If you cannot resolve the issue in 3 attempts, offer to transfer to a human agent.',
    },
  ],
});

agent.promptAddSection('Product Info', {
  bullets: [
    'Widget Pro - Our flagship product, $99/mo',
    'Widget Lite - Basic tier, $29/mo',
    'Widget Enterprise - Custom pricing',
  ],
  numbered: true,
});

// Add a tool for transferring calls
agent.defineTool({
  name: 'transfer_to_human',
  description: 'Transfer the caller to a human support agent',
  parameters: {
    reason: { type: 'string', description: 'Reason for the transfer' },
  },
  handler: (_args) => {
    return new SwaigFunctionResult('Transferring you to a human agent now.')
      .connect('+15551234567');
  },
});

agent.setPostPrompt('Summarize the support interaction including the issue and resolution.');

agent.run();
