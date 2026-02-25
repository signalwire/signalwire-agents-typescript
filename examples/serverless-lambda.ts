/**
 * Serverless Lambda Example
 *
 * Deploy an agent on AWS Lambda using ServerlessAdapter.
 * The adapter converts Lambda events to/from standard HTTP requests.
 * Run: npx tsx examples/serverless-lambda.ts
 */

import { AgentBase, ServerlessAdapter, SwaigFunctionResult } from '../src/index.js';

// Create the agent as usual
export const agent = new AgentBase({
  name: 'lambda-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You are a helpful assistant deployed on AWS Lambda.');
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.defineTool({
  name: 'get_time',
  description: 'Get the current time',
  parameters: {},
  handler: () => new SwaigFunctionResult(`The time is ${new Date().toISOString()}`),
});

// Create a Lambda handler from the agent's Hono app
export const handler = ServerlessAdapter.createLambdaHandler(agent.getApp());

// For local development, run the agent normally
agent.run();
