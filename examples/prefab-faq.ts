/**
 * FAQ Bot Prefab Example
 *
 * Answers frequently asked questions using keyword matching.
 * Falls back to escalation if no match is found.
 * Run: npx tsx examples/prefab-faq.ts
 */

import { FAQBotAgent } from '../src/index.js';

export const agent = new FAQBotAgent({
  name: 'help-desk',
  faqs: [
    {
      question: 'What are your business hours?',
      answer: 'We are open Monday through Friday, 9 AM to 5 PM Eastern Time.',
      keywords: ['hours', 'open', 'close', 'schedule', 'when'],
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page and click "Forgot Password". Enter your email and we\'ll send a reset link.',
      keywords: ['password', 'reset', 'forgot', 'login', 'access'],
    },
    {
      question: 'What is your return policy?',
      answer: 'We accept returns within 30 days of purchase with a valid receipt. Items must be in original condition.',
      keywords: ['return', 'refund', 'exchange', 'money back'],
    },
    {
      question: 'How can I track my order?',
      answer: 'Log into your account and go to Order History. Click on your order number to see tracking details.',
      keywords: ['track', 'order', 'shipping', 'delivery', 'where'],
    },
    {
      question: 'Do you offer international shipping?',
      answer: 'Yes, we ship to over 50 countries. International shipping rates are calculated at checkout.',
      keywords: ['international', 'shipping', 'overseas', 'global', 'country'],
    },
  ],
  threshold: 0.4,
  escalationMessage: 'I couldn\'t find an answer to that. Let me connect you with a team member.',
  escalationNumber: '+18005551234',
  agentOptions: {
    route: '/',
    basicAuth: ['user', 'pass'],
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
