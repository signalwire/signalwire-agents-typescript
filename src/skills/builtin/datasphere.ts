/**
 * DataSphere Skill - Searches SignalWire DataSphere for knowledge base content.
 *
 * Tier 3 built-in skill: requires SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN,
 * and SIGNALWIRE_SPACE environment variables. Uses the SignalWire DataSphere
 * API to perform semantic search across uploaded documents.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

interface DataSphereResult {
  text: string;
  score: number;
  document_id?: string;
  metadata?: Record<string, unknown>;
  chunk_index?: number;
}

interface DataSphereResponse {
  results?: DataSphereResult[];
  error?: string;
  message?: string;
}

export class DataSphereSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('datasphere', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'datasphere',
      description:
        'Searches SignalWire DataSphere for knowledge base content using semantic search across uploaded documents.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'datasphere', 'signalwire', 'knowledge', 'rag', 'external'],
      requiredEnvVars: ['SIGNALWIRE_PROJECT_ID', 'SIGNALWIRE_TOKEN', 'SIGNALWIRE_SPACE'],
      configSchema: {
        max_results: {
          type: 'number',
          description: 'Maximum number of results to return. Defaults to 5.',
          default: 5,
        },
        distance_threshold: {
          type: 'number',
          description:
            'Maximum distance threshold for results (0-1, lower is more similar). Defaults to 0.7.',
          default: 0.7,
        },
      },
    };
  }

  getTools(): SkillToolDefinition[] {
    const maxResults = this.getConfig<number>('max_results', 5);
    const distanceThreshold = this.getConfig<number>('distance_threshold', 0.7);

    return [
      {
        name: 'search_datasphere',
        description:
          'Search the SignalWire DataSphere knowledge base for relevant information. Returns the most relevant text chunks from uploaded documents.',
        parameters: {
          query: {
            type: 'string',
            description: 'The question or topic to search for in the knowledge base.',
          },
          document_id: {
            type: 'string',
            description:
              'Optional: limit search to a specific document by its ID.',
          },
        },
        required: ['query'],
        handler: async (args: Record<string, unknown>) => {
          const query = args.query as string | undefined;
          const documentId = args.document_id as string | undefined;

          if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new SwaigFunctionResult(
              'Please provide a query to search the knowledge base.',
            );
          }

          const projectId = process.env['SIGNALWIRE_PROJECT_ID'];
          const token = process.env['SIGNALWIRE_TOKEN'];
          const space = process.env['SIGNALWIRE_SPACE'];

          if (!projectId || !token || !space) {
            return new SwaigFunctionResult(
              'DataSphere is not configured. The SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN, and SIGNALWIRE_SPACE environment variables are required.',
            );
          }

          try {
            const spaceHost = space.includes('.') ? space : `${space}.signalwire.com`;
            const url = `https://${spaceHost}/api/datasphere/documents/search`;

            const requestBody: Record<string, unknown> = {
              query: query.trim(),
              count: maxResults,
              distance: distanceThreshold,
            };

            if (documentId && typeof documentId === 'string' && documentId.trim().length > 0) {
              requestBody['document_id'] = documentId.trim();
            }

            const authHeader = Buffer.from(`${projectId}:${token}`).toString('base64');

            const response = await fetch(url, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${authHeader}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              let errorMsg: string;
              try {
                const errorData = JSON.parse(errorText) as DataSphereResponse;
                errorMsg = errorData.error ?? errorData.message ?? `HTTP ${response.status}`;
              } catch {
                errorMsg = `HTTP ${response.status}: ${errorText.slice(0, 200)}`;
              }
              return new SwaigFunctionResult(
                `DataSphere search failed: ${errorMsg}`,
              );
            }

            const data = (await response.json()) as DataSphereResponse;

            if (!data.results || data.results.length === 0) {
              return new SwaigFunctionResult(
                `No relevant results found in the knowledge base for "${query}".`,
              );
            }

            const parts: string[] = [
              `Knowledge base results for "${query}" (${data.results.length} results):`,
              '',
            ];

            for (let i = 0; i < data.results.length; i++) {
              const result = data.results[i];
              const score = (1 - result.score).toFixed(2);
              parts.push(`--- Result ${i + 1} (relevance: ${score}) ---`);
              parts.push(result.text.trim());
              if (result.document_id) {
                parts.push(`[Document: ${result.document_id}]`);
              }
              parts.push('');
            }

            return new SwaigFunctionResult(parts.join('\n').trim());
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to search DataSphere for "${query}": ${message}`,
            );
          }
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Knowledge Base Search (DataSphere)',
        body: 'You have access to a knowledge base of documents that can be searched for relevant information.',
        bullets: [
          'Use the search_datasphere tool when the user asks questions that might be answered by internal documentation or uploaded knowledge.',
          'Results are ranked by relevance. Higher relevance scores indicate better matches.',
          'You can optionally search within a specific document by providing its ID.',
          'Synthesize information from multiple results when appropriate.',
          'If no results are found, let the user know and suggest rephrasing their question.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating DataSphereSkill instances.
 */
export function createSkill(config?: SkillConfig): DataSphereSkill {
  return new DataSphereSkill(config);
}
