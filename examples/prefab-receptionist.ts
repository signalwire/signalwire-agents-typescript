/**
 * Receptionist Prefab Example
 *
 * Front-desk agent with visitor check-in, department directory,
 * and call transfers by extension.
 * Run: npx tsx examples/prefab-receptionist.ts
 */

import { ReceptionistAgent } from '../src/index.js';

export const agent = new ReceptionistAgent({
  name: 'front-desk',
  companyName: 'Acme Technologies',
  departments: [
    { name: 'Engineering', extension: '1001', description: 'Software development team' },
    { name: 'Marketing', extension: '1002', description: 'Marketing and communications' },
    { name: 'Human Resources', extension: '1003', description: 'HR, hiring, and benefits' },
    { name: 'Finance', extension: '1004', description: 'Accounting and finance' },
  ],
  welcomeMessage: 'Welcome to Acme Technologies! I\'m the front desk assistant. How can I help you today?',
  checkInEnabled: true,
  onVisitorCheckIn: (visitor) => {
    console.log('Visitor checked in:', visitor);
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
