/**
 * Contexts & Steps Example
 *
 * Multi-step conversation workflows where the AI follows a structured
 * sequence of steps, each with its own prompt, criteria, and allowed tools.
 * Run: npx tsx examples/contexts-steps.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'quiz-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText('You are a fun quiz host named Quizzy.');

// Define tools
agent.defineTool({
  name: 'get_score',
  description: 'Get the current score for the player',
  parameters: {},
  handler: () => new SwaigFunctionResult('The player has 3 out of 5 correct.'),
});

agent.defineTool({
  name: 'submit_answer',
  description: 'Submit an answer to the current question',
  parameters: {
    answer: { type: 'string', description: 'The answer to check' },
  },
  handler: (args) => {
    return new SwaigFunctionResult(`The answer "${args.answer}" has been recorded.`);
  },
});

// Define the conversation flow
const ctx = agent.defineContexts();
const quiz = ctx.addContext('default');

// Step 1: Greet the player
quiz
  .addStep('greeting', { task: 'Welcome the player and explain the quiz rules.' })
  .setStepCriteria('Player has acknowledged the rules and is ready to start')
  .setFunctions('none') // No tools needed for greeting
  .setValidSteps(['question']);

// Step 2: Ask questions
quiz
  .addStep('question', { task: 'Ask the player a trivia question and evaluate their answer.' })
  .setStepCriteria('Player has answered the question')
  .setFunctions(['submit_answer'])
  .setValidSteps(['question', 'results']);

// Step 3: Show results
quiz
  .addStep('results', { task: 'Show the final score and thank the player for playing.' })
  .setFunctions(['get_score'])
  .setEnd(true);

agent.run();
