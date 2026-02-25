/**
 * Joke Skill - Tells random jokes from a built-in collection.
 *
 * Tier 1 built-in skill: no external dependencies required.
 * Contains a curated set of jokes across multiple categories.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

/** Internal representation of a joke with setup and punchline. */
interface Joke {
  /** Joke category (e.g., "general", "programming", "dad"). */
  category: string;
  /** The joke setup line. */
  setup: string;
  /** The joke punchline. */
  punchline: string;
}

const JOKES: Joke[] = [
  // General
  {
    category: 'general',
    setup: 'Why did the scarecrow win an award?',
    punchline: 'Because he was outstanding in his field.',
  },
  {
    category: 'general',
    setup: 'What do you call a fake noodle?',
    punchline: 'An impasta.',
  },
  {
    category: 'general',
    setup: 'Why did the bicycle fall over?',
    punchline: 'Because it was two-tired.',
  },
  // Programming
  {
    category: 'programming',
    setup: 'Why do programmers prefer dark mode?',
    punchline: 'Because light attracts bugs.',
  },
  {
    category: 'programming',
    setup: 'What is a programmer\'s favorite hangout place?',
    punchline: 'Foo Bar.',
  },
  {
    category: 'programming',
    setup: 'Why do Java developers wear glasses?',
    punchline: 'Because they can\'t C#.',
  },
  {
    category: 'programming',
    setup: 'How many programmers does it take to change a light bulb?',
    punchline: 'None. That\'s a hardware problem.',
  },
  // Dad jokes
  {
    category: 'dad',
    setup: 'I\'m reading a book about anti-gravity.',
    punchline: 'It\'s impossible to put down.',
  },
  {
    category: 'dad',
    setup: 'What did the ocean say to the beach?',
    punchline: 'Nothing, it just waved.',
  },
  {
    category: 'dad',
    setup: 'Why don\'t skeletons fight each other?',
    punchline: 'They don\'t have the guts.',
  },
];

const VALID_CATEGORIES = ['general', 'programming', 'dad'];

/**
 * Tells random jokes from a curated built-in collection.
 *
 * Tier 1 built-in skill with no external dependencies. Includes general,
 * programming, and dad joke categories.
 */
export class JokeSkill extends SkillBase {
  /**
   * @param config - Optional configuration (no config keys used by this skill).
   */
  constructor(config?: SkillConfig) {
    super('joke', config);
  }

  /** @returns Manifest with skill metadata and tags. */
  getManifest(): SkillManifest {
    return {
      name: 'joke',
      description: 'Tells random jokes from a built-in collection across several categories.',
      version: '1.0.0',
      tags: ['entertainment', 'joke', 'humor'],
    };
  }

  /** @returns A single `tell_joke` tool that returns a random joke with optional category filter. */
  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'tell_joke',
        description:
          'Tell a random joke. Optionally specify a category to get a joke from that category.',
        parameters: {
          category: {
            type: 'string',
            description:
              'Joke category: "general", "programming", or "dad". If not specified, a random joke from any category is returned.',
          },
        },
        handler: (args: Record<string, unknown>) => {
          const category = args.category as string | undefined;

          let pool = JOKES;

          if (category && typeof category === 'string') {
            const normalized = category.toLowerCase().trim();

            if (!VALID_CATEGORIES.includes(normalized)) {
              return new SwaigFunctionResult(
                `Unknown joke category "${category}". Available categories are: ${VALID_CATEGORIES.join(', ')}.`,
              );
            }

            pool = JOKES.filter((j) => j.category === normalized);
          }

          if (pool.length === 0) {
            return new SwaigFunctionResult(
              'Sorry, I could not find any jokes for that category.',
            );
          }

          const joke = pool[Math.floor(Math.random() * pool.length)]!;

          return new SwaigFunctionResult(
            `${joke.setup} ... ${joke.punchline}`,
          );
        },
      },
    ];
  }

  /** @returns Prompt section instructing the AI how to deliver jokes. */
  getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Jokes',
        body: 'You have the ability to tell jokes to lighten the mood.',
        bullets: [
          'Use the tell_joke tool when a user asks for a joke or when humor is appropriate.',
          'Available joke categories: general, programming, and dad jokes.',
          'If the user asks for a specific type of joke, pass the category parameter.',
          'Deliver the joke naturally: say the setup, pause briefly, then deliver the punchline.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating JokeSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new JokeSkill instance.
 */
export function createSkill(config?: SkillConfig): JokeSkill {
  return new JokeSkill(config);
}
