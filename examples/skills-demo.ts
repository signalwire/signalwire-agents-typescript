/**
 * Skills Demo Example
 *
 * Shows how to add built-in skills (datetime, math) to an agent.
 * Skills inject tools, prompt sections, and hints automatically.
 * Run: npx tsx examples/skills-demo.ts
 */

import { AgentBase, DateTimeSkill, MathSkill } from '../src/index.js';

export const agent = new AgentBase({
  name: 'skilled-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText(
  'You are a helpful assistant with access to time and math tools. ' +
  'Use the available tools to answer questions about dates, times, and calculations.',
);

// Add skills — each injects its own tools, prompt sections, and hints
await agent.addSkill(new DateTimeSkill());
await agent.addSkill(new MathSkill());

// List what skills are loaded
console.log('Loaded skills:', agent.listSkills().map(s => s.name));

// Query parameter schemas programmatically
console.log('DateTimeSkill parameters:', DateTimeSkill.getParameterSchema());
console.log('MathSkill parameters:', MathSkill.getParameterSchema());

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
