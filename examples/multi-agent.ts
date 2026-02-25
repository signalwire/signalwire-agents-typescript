/**
 * Multi-Agent Server Example
 *
 * Host multiple agents under a single HTTP server, each at its own route.
 * Run: npx tsx examples/multi-agent.ts
 * Test:
 *   curl http://user:pass@localhost:3000/support
 *   curl http://user:pass@localhost:3000/sales
 *   curl http://localhost:3000/          (agent listing)
 *   curl http://localhost:3000/health
 */

import { AgentBase, AgentServer, SwaigFunctionResult } from '../src/index.js';

// --- Support Agent ---
export const support = new AgentBase({
  name: 'support',
  route: '/support',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

support.setPromptText('You are a customer support agent. Help resolve issues quickly and politely.');
support.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

support.defineTool({
  name: 'lookup_ticket',
  description: 'Look up a support ticket by ID',
  parameters: {
    ticket_id: { type: 'string', description: 'The ticket ID' },
  },
  handler: (args) => {
    return new SwaigFunctionResult(`Ticket ${args.ticket_id}: Status is "In Progress", assigned to Team B.`);
  },
});

// --- Sales Agent ---
export const sales = new AgentBase({
  name: 'sales',
  route: '/sales',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

sales.setPromptText('You are a sales agent. Help potential customers understand our products and pricing.');
sales.addLanguage({ name: 'English', code: 'en-US', voice: 'dave' });

sales.defineTool({
  name: 'get_pricing',
  description: 'Get pricing information for a product',
  parameters: {
    product: { type: 'string', description: 'Product name' },
  },
  handler: (args) => {
    const prices: Record<string, string> = {
      basic: '$29/mo',
      pro: '$99/mo',
      enterprise: 'Custom pricing - schedule a call',
    };
    const price = prices[args.product?.toLowerCase()] ?? 'Product not found';
    return new SwaigFunctionResult(`Pricing for ${args.product}: ${price}`);
  },
});

// --- Server ---
const server = new AgentServer({ port: 3000 });
server.register(support);
server.register(sales);
server.run();
