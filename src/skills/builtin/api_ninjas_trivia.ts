/**
 * API Ninjas Trivia Skill - Fetches trivia questions from the API Ninjas service.
 *
 * Tier 2 built-in skill: requires API_NINJAS_KEY environment variable.
 * Uses the API Ninjas Trivia endpoint to retrieve random trivia questions
 * with optional category filtering.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

interface TriviaResponse {
  category: string;
  question: string;
  answer: string;
}

const VALID_CATEGORIES = [
  'artliterature',
  'language',
  'sciencenature',
  'general',
  'fooddrink',
  'peopleplaces',
  'geography',
  'historyholidays',
  'entertainment',
  'toysgames',
  'music',
  'mathematics',
  'religionmythology',
  'sportsleisure',
] as const;

export class ApiNinjasTriviaSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('api_ninjas_trivia', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'api_ninjas_trivia',
      description:
        'Fetches trivia questions from the API Ninjas service. Supports multiple categories for varied trivia topics.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['trivia', 'api', 'entertainment', 'quiz', 'external'],
      requiredEnvVars: ['API_NINJAS_KEY'],
      configSchema: {
        default_category: {
          type: 'string',
          description:
            'Default trivia category if none is specified by the user.',
        },
        reveal_answer: {
          type: 'boolean',
          description:
            'Whether to include the answer in the response. Defaults to false so the AI can quiz the user.',
          default: false,
        },
      },
    };
  }

  getTools(): SkillToolDefinition[] {
    const defaultCategory = this.getConfig<string | undefined>(
      'default_category',
      undefined,
    );
    const revealAnswer = this.getConfig<boolean>('reveal_answer', false);

    return [
      {
        name: 'get_trivia',
        description:
          'Get a random trivia question. Optionally specify a category to narrow the topic.',
        parameters: {
          category: {
            type: 'string',
            description:
              'Trivia category. Available categories: ' +
              VALID_CATEGORIES.join(', ') +
              '. If not specified, a random category is used.',
          },
        },
        handler: async (args: Record<string, unknown>) => {
          const apiKey = process.env['API_NINJAS_KEY'];
          if (!apiKey) {
            return new SwaigFunctionResult(
              'Trivia service is not configured. The API_NINJAS_KEY environment variable is missing.',
            );
          }

          let category = (args.category as string | undefined) ?? defaultCategory;

          // Validate category if provided
          if (category && typeof category === 'string') {
            const normalized = category.toLowerCase().trim().replace(/[\s_-]/g, '');
            if (
              !VALID_CATEGORIES.includes(
                normalized as (typeof VALID_CATEGORIES)[number],
              )
            ) {
              return new SwaigFunctionResult(
                `Unknown trivia category "${category}". Available categories: ${VALID_CATEGORIES.join(', ')}.`,
              );
            }
            category = normalized;
          }

          try {
            const url = category
              ? `https://api.api-ninjas.com/v1/trivia?category=${encodeURIComponent(category)}`
              : 'https://api.api-ninjas.com/v1/trivia';

            const response = await fetch(url, {
              headers: {
                'X-Api-Key': apiKey,
              },
            });

            if (!response.ok) {
              return new SwaigFunctionResult(
                `Failed to fetch trivia: HTTP ${response.status} ${response.statusText}. Please try again later.`,
              );
            }

            const data = (await response.json()) as TriviaResponse[];

            if (!Array.isArray(data) || data.length === 0) {
              return new SwaigFunctionResult(
                'No trivia questions were returned. Please try again or try a different category.',
              );
            }

            const trivia = data[0]!;

            if (revealAnswer) {
              return new SwaigFunctionResult(
                `Trivia (${trivia.category}): ${trivia.question} Answer: ${trivia.answer}`,
              );
            }

            // When not revealing the answer, provide it in a structured way
            // so the AI knows the answer but can quiz the user
            return new SwaigFunctionResult(
              `Here is a trivia question from the "${trivia.category}" category. ` +
                `Question: ${trivia.question} ` +
                `[The correct answer is: ${trivia.answer}. Do not reveal this unless the user attempts an answer or asks for it.]`,
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to fetch trivia question: ${message}`,
            );
          }
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    const revealAnswer = this.getConfig<boolean>('reveal_answer', false);

    const bullets: string[] = [
      'Use the get_trivia tool to fetch a random trivia question.',
      `Available categories: ${VALID_CATEGORIES.join(', ')}.`,
      'If no category is specified, a random category will be selected.',
    ];

    if (!revealAnswer) {
      bullets.push(
        'When you receive a trivia question, ask it to the user and let them try to answer before revealing the correct answer.',
        'If the user gets it wrong, give them a hint or tell them the correct answer.',
      );
    } else {
      bullets.push(
        'Trivia answers are included in the response. Share the question and answer with the user.',
      );
    }

    bullets.push(
      'Keep trivia fun and engaging. Encourage the user to try more questions.',
    );

    return [
      {
        title: 'Trivia Questions',
        body: 'You can fetch and ask trivia questions from a wide range of categories.',
        bullets,
      },
    ];
  }

  getHints(): string[] {
    return ['trivia', 'quiz', 'question', 'fun fact'];
  }
}

/**
 * Factory function for creating ApiNinjasTriviaSkill instances.
 */
export function createSkill(config?: SkillConfig): ApiNinjasTriviaSkill {
  return new ApiNinjasTriviaSkill(config);
}
