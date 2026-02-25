/**
 * InfoGatherer Prefab Example
 *
 * Collects structured data from callers: name, email, phone.
 * Validates each field with regex, fires onComplete when done.
 * Run: npx tsx examples/prefab-info-gatherer.ts
 */

import { InfoGathererAgent } from '../src/index.js';

export const agent = new InfoGathererAgent({
  name: 'intake-agent',
  fields: [
    {
      name: 'full_name',
      description: 'The caller\'s full name (first and last)',
      required: true,
    },
    {
      name: 'email',
      description: 'The caller\'s email address',
      required: true,
      validation: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    {
      name: 'phone',
      description: 'A callback phone number',
      required: true,
      validation: /^\+?[\d\s\-()]{7,15}$/,
    },
    {
      name: 'company',
      description: 'The caller\'s company or organization',
      required: false,
    },
  ],
  introMessage: 'Hi there! I need to collect a few details from you. Let\'s start with your name.',
  confirmationMessage: 'Great, I have everything I need. Thank you for your time!',
  onComplete: (data) => {
    console.log('All fields collected:', data);
  },
  agentOptions: {
    route: '/',
    basicAuth: [
      process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
      process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
    ],
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
