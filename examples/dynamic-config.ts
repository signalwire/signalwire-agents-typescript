/**
 * Dynamic Configuration Example
 *
 * Customize agent behavior per-request based on query parameters,
 * headers, or request body. Each request gets an ephemeral copy
 * of the agent, so modifications don't affect other callers.
 * Run: npx tsx examples/dynamic-config.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'dynamic-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText('You are a helpful assistant.');

agent.defineTool({
  name: 'greet',
  description: 'Greet the user by name',
  parameters: {},
  handler: () => new SwaigFunctionResult('Hello!'),
});

// Customize the agent per-request
agent.setDynamicConfigCallback(async (queryParams, bodyParams, headers, agentCopy) => {
  const copy = agentCopy as AgentBase;

  // Customize based on query params (e.g., ?lang=es&name=Carlos)
  const lang = queryParams['lang'];
  if (lang === 'es') {
    copy.setPromptText('Eres un asistente amigable. Responde siempre en español.');
    copy.setLanguages([{ name: 'Spanish', code: 'es-ES', voice: 'polly.Lucia' }]);
  } else if (lang === 'fr') {
    copy.setPromptText('Vous êtes un assistant sympathique. Répondez toujours en français.');
    copy.setLanguages([{ name: 'French', code: 'fr-FR', voice: 'polly.Celine' }]);
  }

  // Customize based on caller info from the request body
  const callerName = queryParams['name'] ?? (bodyParams['caller_name'] as string);
  if (callerName) {
    copy.setGlobalData({ caller_name: callerName });
    copy.setPromptText(
      `You are a helpful assistant. The caller's name is ${callerName}. Greet them by name.`,
    );
  }
});

agent.run();
