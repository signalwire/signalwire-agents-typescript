/**
 * Kubernetes-Ready Agent Example
 *
 * Agent with graceful shutdown for clean K8s/Docker stops,
 * health check endpoints, and structured logging.
 * Run: npx tsx examples/kubernetes-agent.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

// Set up graceful shutdown before anything else
AgentBase.setupGracefulShutdown({ timeout: 10000 });

export const agent = new AgentBase({
  name: 'k8s-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText(
  'You are a production-grade assistant running in Kubernetes. ' +
  'Respond helpfully and professionally.',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.defineTool({
  name: 'get_status',
  description: 'Get the current service status',
  parameters: {},
  handler: () => {
    return new SwaigFunctionResult(
      `Service is healthy. Uptime: ${Math.floor(process.uptime())}s. Memory: ${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB.`,
    );
  },
});

// Health check is built into AgentBase at /health and /ready
// K8s liveness probe:  GET /health -> {"status":"ok"}
// K8s readiness probe: GET /ready  -> {"status":"ready"}

agent.run();
