/**
 * DataSphere Serverless Skill - Searches SignalWire DataSphere using a DataMap.
 *
 * Tier 3 built-in skill: requires SIGNALWIRE_PROJECT_ID, SIGNALWIRE_TOKEN,
 * and SIGNALWIRE_SPACE environment variables. Unlike the standard datasphere
 * skill, this uses a DataMap to execute the search server-side without
 * requiring a webhook endpoint. Ideal for serverless or edge deployments.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';
import { DataMap } from '../../DataMap.js';

export class DataSphereServerlessSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('datasphere_serverless', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'datasphere_serverless',
      description:
        'Searches SignalWire DataSphere using a server-side DataMap. No webhook endpoint required; executes entirely on the SignalWire platform.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'datasphere', 'signalwire', 'knowledge', 'rag', 'serverless', 'datamap'],
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
        document_id: {
          type: 'string',
          description: 'Optional: restrict search to a specific document ID.',
        },
      },
    };
  }

  /**
   * Build the DataMap-based SWAIG function definition for server-side
   * DataSphere search. This generates a data_map configuration that
   * SignalWire executes directly, without needing a webhook callback.
   */
  private buildDataMapFunction(): Record<string, unknown> {
    const maxResults = this.getConfig<number>('max_results', 5);
    const distanceThreshold = this.getConfig<number>('distance_threshold', 0.7);
    const documentId = this.getConfig<string | undefined>('document_id', undefined);

    const dm = new DataMap('search_datasphere');
    dm.enableEnvExpansion(true);

    dm.purpose(
      'Search the SignalWire DataSphere knowledge base for relevant information. ' +
      'Returns the most relevant text chunks from uploaded documents.',
    );

    dm.parameter('query', 'string', 'The question or topic to search for in the knowledge base.', {
      required: true,
    });

    // Build the request body
    const requestBody: Record<string, unknown> = {
      query: '%{args.query}',
      count: maxResults,
      distance: distanceThreshold,
    };

    if (documentId) {
      requestBody['document_id'] = documentId;
    }

    // Configure the webhook to call the DataSphere API
    dm.webhook('POST', 'https://${ENV.SIGNALWIRE_SPACE}.signalwire.com/api/datasphere/documents/search', {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ${ENV.SIGNALWIRE_AUTH}',
      },
    });

    dm.body(requestBody);

    dm.output(
      new SwaigFunctionResult(
        'Knowledge base results for the query: %{array[0].text} %{array[1].text} %{array[2].text}',
      ),
    );

    dm.errorKeys(['error', 'message']);

    dm.fallbackOutput(
      new SwaigFunctionResult(
        'No relevant results found in the knowledge base. Try rephrasing your question.',
      ),
    );

    return dm.toSwaigFunction();
  }

  /**
   * Returns an empty array because this skill uses DataMap-based tools
   * instead of handler-based tools. The DataMap function is registered
   * via getDataMapTools().
   */
  getTools(): SkillToolDefinition[] {
    // DataMap-based skills do not use handler-based tools.
    // The tool is provided via getDataMapTools() instead.
    // We return a stub handler that explains this to prevent confusion
    // if something tries to invoke it as a regular tool.
    return [
      {
        name: 'search_datasphere',
        description:
          'Search the SignalWire DataSphere knowledge base for relevant information. (Serverless DataMap mode)',
        parameters: {
          query: {
            type: 'string',
            description: 'The question or topic to search for in the knowledge base.',
          },
        },
        required: ['query'],
        handler: () => {
          return new SwaigFunctionResult(
            'This tool is configured for serverless DataMap execution. ' +
            'It should be registered as a data_map function, not invoked via webhook.',
          );
        },
      },
    ];
  }

  /**
   * Get DataMap-based tool definitions for server-side execution.
   * These are registered directly in the SWML output as data_map functions
   * rather than as webhook-backed SWAIG tools.
   */
  getDataMapTools(): Record<string, unknown>[] {
    return [this.buildDataMapFunction()];
  }

  getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Knowledge Base Search (DataSphere - Serverless)',
        body: 'You have access to a knowledge base of documents that can be searched for relevant information. Searches are executed server-side for optimal performance.',
        bullets: [
          'Use the search_datasphere tool when the user asks questions that might be answered by internal documentation or uploaded knowledge.',
          'Results are ranked by relevance and returned automatically.',
          'This search runs entirely on the SignalWire platform without requiring external webhooks.',
          'Synthesize information from the results when appropriate.',
          'If no results are found, let the user know and suggest rephrasing their question.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating DataSphereServerlessSkill instances.
 */
export function createSkill(config?: SkillConfig): DataSphereServerlessSkill {
  return new DataSphereServerlessSkill(config);
}
