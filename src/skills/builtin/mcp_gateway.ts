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
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

export class McpGatewaySkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('mcp_gateway', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'mcp_gateway',
      description: 'MCP protocol gateway (placeholder). Will provide integration with Model Context Protocol servers for external tool invocation.',
      version: '0.1.0',
      author: 'SignalWire',
      tags: ['mcp', 'gateway', 'protocol', 'tools', 'integration', 'placeholder'],
    };
  }

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

  getPromptSections(): SkillPromptSection[] {
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
 */
export function createSkill(config?: SkillConfig): McpGatewaySkill {
  return new McpGatewaySkill(config);
}
