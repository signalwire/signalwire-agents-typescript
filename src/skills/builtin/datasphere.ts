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
  ParameterSchemaEntry,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

/** A single search result from the DataSphere API. */
interface DataSphereResult {
  /** Matched text chunk content. */
  text: string;
  /** Distance score (lower is more similar). */
  score: number;
  /** ID of the source document. */
  document_id?: string;
  /** Document metadata. */
  metadata?: Record<string, unknown>;
  /** Index of the chunk within the document. */
  chunk_index?: number;
}

/** Response shape from the SignalWire DataSphere search API. */
interface DataSphereResponse {
  /** Array of search results. */
  results?: DataSphereResult[];
  /** Error message if the request failed. */
  error?: string;
  /** Additional error information. */
  message?: string;
}

/**
 * Searches SignalWire DataSphere for knowledge base content using semantic search.
 *
 * Tier 3 built-in skill. Requires `SIGNALWIRE_PROJECT_ID`, `SIGNALWIRE_TOKEN`,
 * and `SIGNALWIRE_SPACE` environment variables. Supports `max_results` and
 * `distance_threshold` config options.
 */
export class DataSphereSkill extends SkillBase {
  static override SUPPORTS_MULTIPLE_INSTANCES = true;

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tool_name: {
        type: 'string',
        description: 'Custom tool name for this DataSphere instance.',
      },
      space_name: {
        type: 'string',
        description: 'SignalWire space name.',
        env_var: 'SIGNALWIRE_SPACE',
      },
      project_id: {
        type: 'string',
        description: 'SignalWire project ID.',
        env_var: 'SIGNALWIRE_PROJECT_ID',
      },
      token: {
        type: 'string',
        description: 'SignalWire auth token.',
        hidden: true,
        env_var: 'SIGNALWIRE_TOKEN',
      },
      document_id: {
        type: 'string',
        description: 'Optional: restrict search to a specific document ID.',
      },
      max_results: {
        type: 'number',
        description: 'Maximum number of results to return.',
        default: 5,
      },
      distance_threshold: {
        type: 'number',
        description: 'Maximum distance threshold for results (0-1).',
        default: 0.7,
        min: 0,
        max: 1,
      },
    };
  }

  /**
   * @param config - Optional configuration; supports `max_results` and `distance_threshold`.
   */
  constructor(config?: SkillConfig) {
    super('datasphere', config);
  }

  override getInstanceKey(): string {
    const toolName = this.getConfig<string | undefined>('tool_name', undefined);
    return toolName ? `${this.skillName}_${toolName}` : this.skillName;
  }

  /** @returns Manifest declaring SignalWire credentials as required env vars. */
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

  /** @returns A single `search_datasphere` tool that performs semantic search on uploaded documents. */
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

  /** @returns Prompt section describing DataSphere knowledge base search capabilities. */
  protected override _getPromptSections(): SkillPromptSection[] {
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
 * @param config - Optional skill configuration.
 * @returns A new DataSphereSkill instance.
 */
export function createSkill(config?: SkillConfig): DataSphereSkill {
  return new DataSphereSkill(config);
}
