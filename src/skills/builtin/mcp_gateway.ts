/**
 * MCP Gateway Skill - Placeholder for Model Context Protocol integration.
 *
 * Tier 3 built-in skill: stub implementation for future MCP server gateway.
 * This skill will eventually allow agents to invoke tools exposed by MCP
 * (Model Context Protocol) servers, enabling integration with external
 * tool providers via the MCP standard.
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

/**
 * Placeholder skill for future Model Context Protocol (MCP) server integration.
 *
 * Tier 3 stub implementation. When fully implemented, this skill will allow
 * agents to invoke tools exposed by external MCP servers. Currently provides
 * a non-functional `mcp_invoke` tool that returns a "not yet implemented" message.
 */
export class McpGatewaySkill extends SkillBase {
  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      gateway_url: {
        type: 'string',
        description: 'URL of the MCP gateway server.',
      },
      tool_prefix: {
        type: 'string',
        description: 'Prefix for tool names from this gateway.',
      },
      auth_token: {
        type: 'string',
        description: 'Authentication token for the MCP gateway.',
        hidden: true,
      },
    };
  }

  /**
   * @param config - Optional configuration (reserved for future MCP server settings).
   */
  constructor(config?: SkillConfig) {
    super('mcp_gateway', config);
  }

  /** @returns Manifest with placeholder metadata for the MCP gateway. */
  getManifest(): SkillManifest {
    return {
      name: 'mcp_gateway',
      description: 'MCP protocol gateway (placeholder). Will provide integration with Model Context Protocol servers for external tool invocation.',
      version: '0.1.0',
      author: 'SignalWire',
      tags: ['mcp', 'gateway', 'protocol', 'tools', 'integration', 'placeholder'],
    };
  }

  /** @returns A single placeholder `mcp_invoke` tool (not yet functional). */
  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'mcp_invoke',
        description:
          'Invoke a method on an MCP (Model Context Protocol) server. Currently a placeholder for future implementation.',
        parameters: {
          server: {
            type: 'string',
            description: 'The MCP server name or URL to connect to.',
          },
          method: {
            type: 'string',
            description: 'The method/tool name to invoke on the MCP server.',
          },
          params: {
            type: 'object',
            description: 'Parameters to pass to the MCP method.',
          },
        },
        required: ['server', 'method'],
        handler: () => {
          return new SwaigFunctionResult(
            'MCP gateway is not yet implemented. Configure MCP servers to use this skill.',
          );
        },
      },
    ];
  }

  /** @returns Prompt section explaining the MCP gateway placeholder status. */
  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'MCP Gateway (Placeholder)',
        body: 'The MCP gateway skill is available but not yet fully implemented.',
        bullets: [
          'The mcp_invoke tool is a placeholder for future MCP (Model Context Protocol) integration.',
          'When implemented, it will allow you to invoke tools from external MCP servers.',
          'If a user asks about MCP functionality, let them know it is planned for a future release.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating McpGatewaySkill instances.
 * @param config - Optional skill configuration.
 * @returns A new McpGatewaySkill instance.
 */
export function createSkill(config?: SkillConfig): McpGatewaySkill {
  return new McpGatewaySkill(config);
}
