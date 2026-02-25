/**
 * Advanced Dynamic Config Example
 *
 * Per-request agent customization: VIP detection, department routing,
 * language selection, and tiered service levels.
 * Run: npx tsx examples/advanced-dynamic-config.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'smart-router',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText('You are a helpful customer service assistant.');
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.defineTool({
  name: 'lookup_account',
  description: 'Look up a customer account by phone number',
  parameters: {
    phone: { type: 'string', description: 'The customer phone number' },
  },
  handler: (args) => {
    return new SwaigFunctionResult(`Account lookup for ${args.phone}: Active, Premium tier.`);
  },
});

// VIP numbers get premium treatment
const VIP_NUMBERS = ['+15551234567', '+15559876543'];

agent.setDynamicConfigCallback(async (queryParams, bodyParams, _headers, agentCopy) => {
  const copy = agentCopy as AgentBase;
  const callerNumber = (bodyParams['call'] as Record<string, unknown>)?.['from'] as string ?? '';

  // VIP detection
  if (VIP_NUMBERS.includes(callerNumber)) {
    copy.setPromptText(
      'You are a premium concierge assistant. This is a VIP caller — provide priority service, ' +
      'be extra attentive, and offer to escalate any issues immediately.',
    );
    copy.setParam('temperature', 0.3);
    copy.updateGlobalData({ tier: 'vip', caller: callerNumber });
  }

  // Department routing via query params
  const dept = queryParams['department'];
  if (dept === 'sales') {
    copy.setPromptText('You are a sales assistant. Help the caller with product info and pricing.');
  } else if (dept === 'support') {
    copy.setPromptText('You are a technical support agent. Help diagnose and resolve issues.');
  }

  // Language selection
  const lang = queryParams['lang'];
  if (lang === 'es') {
    copy.setPromptText('Eres un asistente de servicio al cliente. Responde siempre en espanol.');
    copy.setLanguages([{ name: 'Spanish', code: 'es-ES', voice: 'polly.Lucia' }]);
  } else if (lang === 'fr') {
    copy.setPromptText('Vous etes un assistant du service client. Repondez toujours en francais.');
    copy.setLanguages([{ name: 'French', code: 'fr-FR', voice: 'polly.Celine' }]);
  }
});

agent.run();
