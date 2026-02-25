/**
 * Concierge Prefab Example
 *
 * Multi-department routing with knowledge base, hours of operation,
 * and call transfer capabilities.
 * Run: npx tsx examples/prefab-concierge.ts
 */

import { ConciergeAgent } from '../src/index.js';

export const agent = new ConciergeAgent({
  name: 'office-concierge',
  companyName: 'Acme Technologies',
  generalInfo: 'Acme Technologies is a leading provider of cloud communications. Founded in 2010, we serve over 10,000 customers worldwide.',
  departments: [
    {
      name: 'Sales',
      description: 'New accounts, pricing, and product demos',
      transferNumber: '+18005551001',
      keywords: ['buy', 'pricing', 'demo', 'trial', 'purchase'],
      hoursOfOperation: 'Mon-Fri 8am-6pm EST',
    },
    {
      name: 'Technical Support',
      description: 'Product issues, troubleshooting, and bug reports',
      transferNumber: '+18005551002',
      keywords: ['help', 'broken', 'error', 'bug', 'issue', 'problem'],
      hoursOfOperation: 'Mon-Fri 9am-9pm EST, Sat 10am-4pm EST',
    },
    {
      name: 'Billing',
      description: 'Invoices, payments, and account changes',
      transferNumber: '+18005551003',
      keywords: ['invoice', 'payment', 'charge', 'bill', 'subscription'],
      hoursOfOperation: 'Mon-Fri 9am-5pm EST',
    },
  ],
  afterHoursMessage: 'This department is currently closed. Please call back during business hours or leave a message.',
  agentOptions: {
    route: '/',
    basicAuth: ['user', 'pass'],
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
