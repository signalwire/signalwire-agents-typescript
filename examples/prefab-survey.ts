/**
 * Survey Prefab Example
 *
 * Conducts a customer satisfaction survey with branching logic.
 * Questions branch based on answers (satisfied → ask for details,
 * dissatisfied → ask for improvement areas).
 * Run: npx tsx examples/prefab-survey.ts
 */

import { SurveyAgent } from '../src/index.js';

export const agent = new SurveyAgent({
  name: 'csat-survey',
  questions: [
    {
      id: 'satisfaction',
      text: 'Overall, how satisfied are you with our service?',
      type: 'rating',
      points: { '9': 3, '10': 3, '7': 2, '8': 2 },
    },
    {
      id: 'recommend',
      text: 'Would you recommend us to a friend or colleague?',
      type: 'yes_no',
      nextQuestion: {
        yes: 'best_part',
        no: 'improve',
      },
      points: { yes: 2, no: 0 },
    },
    {
      id: 'best_part',
      text: 'What did you like most about our service?',
      type: 'open_ended',
      nextQuestion: 'final_comments',
    },
    {
      id: 'improve',
      text: 'What area would you most like to see improved?',
      type: 'multiple_choice',
      options: ['Response time', 'Product quality', 'Customer support', 'Pricing'],
      nextQuestion: 'final_comments',
    },
    {
      id: 'final_comments',
      text: 'Any other comments or feedback you\'d like to share?',
      type: 'open_ended',
    },
  ],
  introMessage: 'Thank you for calling! We\'d love your feedback. This survey takes about 2 minutes.',
  completionMessage: 'Thank you for your feedback! It helps us improve.',
  onComplete: (responses, score) => {
    console.log('Survey complete:', { responses, score });
  },
  agentOptions: {
    route: '/',
    basicAuth: ['user', 'pass'],
  },
});

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.run();
