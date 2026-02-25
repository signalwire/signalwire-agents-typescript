/**
 * Wikipedia Search Skill - Searches Wikipedia for article summaries.
 *
 * Tier 3 built-in skill: no external API key required.
 * Uses the Wikipedia REST API to fetch article summaries and extracts
 * for any given topic.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

interface WikipediaSummaryResponse {
  type: string;
  title: string;
  displaytitle?: string;
  extract: string;
  extract_html?: string;
  description?: string;
  content_urls?: {
    desktop?: { page: string };
    mobile?: { page: string };
  };
  thumbnail?: {
    source: string;
    width: number;
    height: number;
  };
}

interface WikipediaSearchResponse {
  pages?: Array<{
    id: number;
    key: string;
    title: string;
    description?: string;
    excerpt?: string;
  }>;
}

export class WikipediaSearchSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('wikipedia_search', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'wikipedia_search',
      description:
        'Searches Wikipedia for article summaries and extracts. No API key required.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'wikipedia', 'encyclopedia', 'knowledge', 'external'],
    };
  }

  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'search_wikipedia',
        description:
          'Search Wikipedia for information about a topic. Returns a summary of the most relevant article.',
        parameters: {
          query: {
            type: 'string',
            description:
              'The topic or term to search for on Wikipedia.',
          },
          sentences: {
            type: 'number',
            description:
              'Number of sentences to return in the summary (1-10). Defaults to 3.',
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const query = args.query as string | undefined;
          const sentences = args.sentences as number | undefined;

          if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new SwaigFunctionResult(
              'Please provide a topic to search for on Wikipedia.',
            );
          }

          const sentenceCount = Math.max(1, Math.min(10, sentences ?? 3));

          try {
            // First, try a direct page summary lookup
            const encodedQuery = encodeURIComponent(query.trim().replace(/\s+/g, '_'));
            const summaryUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodedQuery}`;

            const summaryResponse = await fetch(summaryUrl, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'SignalWireAgentsSDK/1.0' },
            });

            if (summaryResponse.ok) {
              const data = (await summaryResponse.json()) as WikipediaSummaryResponse;

              if (data.type !== 'disambiguation' && data.extract) {
                const extractSentences = data.extract.split(/(?<=[.!?])\s+/);
                const trimmedExtract = extractSentences
                  .slice(0, sentenceCount)
                  .join(' ')
                  .trim();

                const pageUrl = data.content_urls?.desktop?.page ?? '';
                const parts: string[] = [
                  `Wikipedia: ${data.title}`,
                ];
                if (data.description) {
                  parts.push(`(${data.description})`);
                }
                parts.push('');
                parts.push(trimmedExtract);
                if (pageUrl) {
                  parts.push('');
                  parts.push(`Read more: ${pageUrl}`);
                }

                return new SwaigFunctionResult(parts.join('\n').trim());
              }
            }

            // If direct lookup failed, use the search API
            const searchUrl = `https://en.wikipedia.org/w/rest.php/v1/search/page?q=${encodeURIComponent(query.trim())}&limit=1`;

            const searchResponse = await fetch(searchUrl, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'SignalWireAgentsSDK/1.0' },
            });

            if (!searchResponse.ok) {
              return new SwaigFunctionResult(
                `Wikipedia search failed with status ${searchResponse.status}. Please try a different search term.`,
              );
            }

            const searchData = (await searchResponse.json()) as WikipediaSearchResponse;

            if (!searchData.pages || searchData.pages.length === 0) {
              return new SwaigFunctionResult(
                `No Wikipedia article found for "${query}". Try a different search term.`,
              );
            }

            // Fetch the summary for the best match
            const bestMatch = searchData.pages[0];
            const matchUrl = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(bestMatch.key)}`;

            const matchResponse = await fetch(matchUrl, {
              headers: { 'Accept': 'application/json', 'User-Agent': 'SignalWireAgentsSDK/1.0' },
            });

            if (!matchResponse.ok) {
              // Fall back to the search excerpt
              const excerpt = bestMatch.excerpt
                ? bestMatch.excerpt.replace(/<[^>]*>/g, '').trim()
                : 'No summary available.';
              return new SwaigFunctionResult(
                `Wikipedia: ${bestMatch.title}\n\n${excerpt}`,
              );
            }

            const matchData = (await matchResponse.json()) as WikipediaSummaryResponse;
            const extractSentences = matchData.extract.split(/(?<=[.!?])\s+/);
            const trimmedExtract = extractSentences
              .slice(0, sentenceCount)
              .join(' ')
              .trim();

            const pageUrl = matchData.content_urls?.desktop?.page ?? '';
            const parts: string[] = [`Wikipedia: ${matchData.title}`];
            if (matchData.description) {
              parts.push(`(${matchData.description})`);
            }
            parts.push('');
            parts.push(trimmedExtract);
            if (pageUrl) {
              parts.push('');
              parts.push(`Read more: ${pageUrl}`);
            }

            return new SwaigFunctionResult(parts.join('\n').trim());
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to search Wikipedia for "${query}": ${message}`,
            );
          }
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Wikipedia Search',
        body: 'You can search Wikipedia for information about any topic.',
        bullets: [
          'Use the search_wikipedia tool when the user asks about a specific topic, person, place, or concept.',
          'Wikipedia provides encyclopedic summaries that are generally reliable for factual information.',
          'You can specify the number of sentences to return (1-10) for shorter or more detailed summaries.',
          'If a search returns no results, try rephrasing with the most common name or spelling.',
          'Summarize the information naturally rather than reading it verbatim.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating WikipediaSearchSkill instances.
 */
export function createSkill(config?: SkillConfig): WikipediaSearchSkill {
  return new WikipediaSearchSkill(config);
}
