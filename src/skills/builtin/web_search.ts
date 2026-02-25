/**
 * Web Search Skill - Searches the web using Google Custom Search API.
 *
 * Tier 3 built-in skill: requires GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX
 * environment variables. Uses the Google Custom Search JSON API to perform
 * web searches and return formatted results.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';
import { MAX_SKILL_INPUT_LENGTH } from '../../SecurityUtils.js';

/** A single search result item from the Google Custom Search API. */
interface GoogleSearchItem {
  /** Title of the search result. */
  title: string;
  /** URL of the search result. */
  link: string;
  /** Brief text snippet from the page. */
  snippet: string;
  /** Display-friendly domain name. */
  displayLink?: string;
  /** Structured page metadata. */
  pagemap?: Record<string, unknown>;
}

/** Response shape from the Google Custom Search JSON API. */
interface GoogleSearchResponse {
  /** Array of search result items. */
  items?: GoogleSearchItem[];
  /** Metadata about the search execution. */
  searchInformation?: {
    totalResults: string;
    searchTime: number;
    formattedTotalResults: string;
    formattedSearchTime: string;
  };
  /** Error details if the request failed. */
  error?: {
    code: number;
    message: string;
    errors: Array<{ message: string; domain: string; reason: string }>;
  };
}

/**
 * Searches the web using the Google Custom Search JSON API.
 *
 * Tier 3 built-in skill. Requires `GOOGLE_SEARCH_API_KEY` and `GOOGLE_SEARCH_CX`
 * environment variables. Supports `max_results` (1-10) and `safe_search`
 * ("off"|"medium"|"high") config options.
 */
export class WebSearchSkill extends SkillBase {
  /**
   * @param config - Optional configuration; supports `max_results` and `safe_search`.
   */
  constructor(config?: SkillConfig) {
    super('web_search', config);
  }

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      api_key: {
        type: 'string',
        description: 'Google Custom Search API key.',
        hidden: true,
        env_var: 'GOOGLE_SEARCH_API_KEY',
        required: true,
      },
      search_engine_id: {
        type: 'string',
        description: 'Google Custom Search Engine ID (CX).',
        hidden: true,
        env_var: 'GOOGLE_SEARCH_CX',
        required: true,
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return (1-10).',
        default: 5,
        min: 1,
        max: 10,
      },
      safe_search: {
        type: 'string',
        description: 'Safe search level.',
        default: 'medium',
        enum: ['off', 'medium', 'high'],
      },
    };
  }

  /** @returns Manifest declaring GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX as required. */
  getManifest(): SkillManifest {
    return {
      name: 'web_search',
      description:
        'Searches the web using Google Custom Search API and returns formatted results with titles, links, and snippets.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'web', 'google', 'api', 'external'],
      requiredEnvVars: ['GOOGLE_SEARCH_API_KEY', 'GOOGLE_SEARCH_CX'],
      configSchema: {
        max_results: {
          type: 'number',
          description:
            'Maximum number of results to return (1-10). Defaults to 5.',
          default: 5,
        },
        safe_search: {
          type: 'string',
          description:
            'Safe search level: "off", "medium", or "high". Defaults to "medium".',
          default: 'medium',
        },
      },
    };
  }

  /** @returns A single `web_search` tool that performs a Google search and returns formatted results. */
  getTools(): SkillToolDefinition[] {
    const configMaxResults = this.getConfig<number>('max_results', 5);
    const safeSearch = this.getConfig<string>('safe_search', 'medium');

    return [
      {
        name: 'web_search',
        description:
          'Search the web for information on any topic. Returns a list of results with titles, links, and brief descriptions.',
        parameters: {
          query: {
            type: 'string',
            description: 'The search query to look up on the web.',
          },
          num_results: {
            type: 'number',
            description: `Number of results to return (1-10). Defaults to ${configMaxResults}.`,
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const query = args.query as string | undefined;
          const numResults = args.num_results as number | undefined;

          if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new SwaigFunctionResult(
              'Please provide a search query.',
            );
          }

          if (query.length > MAX_SKILL_INPUT_LENGTH) {
            return new SwaigFunctionResult('Search query is too long.');
          }

          const apiKey = process.env['GOOGLE_SEARCH_API_KEY'];
          const cx = process.env['GOOGLE_SEARCH_CX'];

          if (!apiKey || !cx) {
            return new SwaigFunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          const count = Math.max(1, Math.min(10, numResults ?? configMaxResults));

          try {
            const encodedQuery = encodeURIComponent(query.trim());
            const safeParam = safeSearch !== 'off' ? `&safe=${safeSearch}` : '';
            const url =
              `https://www.googleapis.com/customsearch/v1` +
              `?key=${apiKey}&cx=${cx}&q=${encodedQuery}&num=${count}${safeParam}`;

            const response = await fetch(url);
            const data = (await response.json()) as GoogleSearchResponse;

            if (data.error) {
              return new SwaigFunctionResult(
                `Web search failed: ${data.error.message}`,
              );
            }

            if (!data.items || data.items.length === 0) {
              return new SwaigFunctionResult(
                `No results found for "${query}".`,
              );
            }

            const totalResults = data.searchInformation?.formattedTotalResults ?? 'unknown';
            const searchTime = data.searchInformation?.formattedSearchTime ?? 'unknown';

            const parts: string[] = [
              `Web search results for "${query}" (${totalResults} results in ${searchTime} seconds):`,
              '',
            ];

            for (let i = 0; i < data.items.length; i++) {
              const item = data.items[i];
              parts.push(`${i + 1}. ${item.title}`);
              parts.push(`   URL: ${item.link}`);
              if (item.snippet) {
                parts.push(`   ${item.snippet.replace(/\n/g, ' ').trim()}`);
              }
              parts.push('');
            }

            return new SwaigFunctionResult(parts.join('\n').trim());
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to perform web search for "${query}": ${message}`,
            );
          }
        },
      },
    ];
  }

  /** @returns Prompt section describing web search capabilities and usage guidance. */
  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Web Search',
        body: 'You can search the web for current information on any topic.',
        bullets: [
          'Use the web_search tool when the user asks about current events, facts, or any information you may not have.',
          'You can specify the number of results to return (1-10).',
          'Results include titles, URLs, and brief descriptions/snippets.',
          'If a search returns no results, try rephrasing the query or using different terms.',
          'Summarize the search results for the user rather than reading them verbatim.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating WebSearchSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new WebSearchSkill instance.
 */
export function createSkill(config?: SkillConfig): WebSearchSkill {
  return new WebSearchSkill(config);
}
