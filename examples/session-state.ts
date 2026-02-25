/**
 * Session State Example
 *
 * Demonstrates onSummary callback for post-call processing,
 * global data for per-call context, and post-prompt instructions.
 * Run: npx tsx examples/session-state.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';
import type { AgentOptions } from '../src/index.js';

class OrderAgent extends AgentBase {
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are an order status assistant. Help callers check the status of their orders and update shipping preferences.',
    },
    {
      title: 'Rules',
      bullets: [
        'Always ask for the order number first.',
        'Use the lookup_order tool to find order details.',
        'Confirm changes before applying them.',
      ],
    },
  ];

  constructor(opts: AgentOptions) {
    super(opts);
    this.defineTools();
  }

  protected override defineTools(): void {
    this.defineTool({
      name: 'lookup_order',
      description: 'Look up an order by its order number',
      parameters: {
        order_number: { type: 'string', description: 'The order number (e.g., ORD-12345)' },
      },
      handler: (args, rawData) => {
        // Store the order number in global data for the post-prompt summary
        this.updateGlobalData({
          last_order_number: args.order_number,
          call_id: rawData['call_id'],
        });
        return new SwaigFunctionResult(
          `Order ${args.order_number}: Status: Shipped, ETA: 2 business days, Carrier: FedEx`,
        );
      },
    });
  }

  override async onSummary(
    summary: Record<string, unknown> | null,
    rawData: Record<string, unknown>,
  ): Promise<void> {
    console.log('=== Call Summary ===');
    console.log('Call ID:', rawData['call_id']);
    console.log('Summary:', JSON.stringify(summary, null, 2));
    console.log('===================');
  }
}

export const agent = new OrderAgent({
  name: 'order-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

// Global data available to the AI throughout the call
agent.setGlobalData({ company: 'Acme Corp', support_hours: '9am-5pm EST' });

// Post-prompt instructs the AI to generate a structured summary
agent.setPostPrompt(
  'Summarize this call as JSON: { caller_intent, order_numbers_discussed, actions_taken, follow_up_needed }',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
