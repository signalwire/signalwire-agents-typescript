/**
 * Custom Skills - A meta-skill that registers user-defined tools from configuration.
 *
 * Tier 2 built-in skill: no external dependencies required.
 * Allows users to define arbitrary tools via config without writing skill classes.
 * Each tool definition in the config specifies its name, description, parameters,
 * and a handler function body (executed via Function constructor).
 *
 * This is useful for rapid prototyping, simple integrations, and cases where
 * creating a full skill class would be overkill.
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

/** Parameter definition for a custom tool. */
interface CustomToolParameter {
  /** Parameter name. */
  name: string;
  /** Parameter type (e.g., "string", "number"). */
  type: string;
  /** Description of the parameter. */
  description: string;
  /** Whether this parameter is required. */
  required?: boolean;
}

/** Full definition of a user-defined custom tool provided via configuration. */
interface CustomToolDefinition {
  /** Unique tool name. */
  name: string;
  /** Tool description shown to the AI. */
  description: string;
  /** Optional array of parameter definitions. */
  parameters?: CustomToolParameter[];
  /** JavaScript function body executed when the tool is invoked. */
  handler_code: string;
  /** Names of required parameters. */
  required?: string[];
  /** Optional description used in the prompt section instead of the tool description. */
  prompt_description?: string;
  /** Whether to mark the tool as secure. */
  secure?: boolean;
  /** Filler phrases spoken while the tool executes. */
  fillers?: Record<string, string[]>;
}

/** Typed shape of the custom skills configuration object. */
interface CustomSkillsConfigData {
  /** Array of custom tool definitions. */
  tools?: CustomToolDefinition[];
  /** Custom title for the prompt section. */
  prompt_title?: string;
  /** Custom body text for the prompt section. */
  prompt_body?: string;
}

/**
 * A meta-skill that registers user-defined tools from configuration.
 *
 * Tier 2 built-in skill with no external dependencies. Allows users to define
 * arbitrary tools via config without writing skill classes. Each tool definition
 * specifies a name, description, parameters, and a JavaScript handler function
 * body that is compiled via the Function constructor at instantiation time.
 */
export class CustomSkillsSkill extends SkillBase {
  private _compiledHandlers: Map<string, Function> = new Map();
  private _compilationErrors: Map<string, string> = new Map();

  /**
   * @param config - Configuration object containing a `tools` array of custom tool definitions.
   */
  constructor(config?: SkillConfig) {
    super('custom_skills', config);
    this._compileHandlers();
  }

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      tools: {
        type: 'array',
        description: 'Array of custom tool definitions: { name, description, handler_code, parameters?, required?, prompt_description?, secure?, fillers? }.',
        items: { type: 'object' },
      },
      prompt_title: {
        type: 'string',
        description: 'Custom title for the prompt section.',
        default: 'Custom Tools',
      },
      prompt_body: {
        type: 'string',
        description: 'Custom body text for the prompt section.',
      },
    };
  }

  /** @returns Manifest with config schema describing the tools array format. */
  getManifest(): SkillManifest {
    return {
      name: 'custom_skills',
      description:
        'A meta-skill that registers user-defined tools from configuration. Define tools with names, descriptions, parameters, and handler code.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['meta', 'custom', 'extensible', 'dynamic'],
      configSchema: {
        tools: {
          type: 'array',
          description:
            'Array of custom tool definitions: { name, description, parameters?, handler_code, required?, prompt_description?, secure?, fillers? }.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Tool name (must be unique).' },
              description: { type: 'string', description: 'Tool description for the AI.' },
              parameters: {
                type: 'array',
                description: 'Tool parameters: [{ name, type, description, required? }].',
              },
              handler_code: {
                type: 'string',
                description:
                  'JavaScript function body. Receives (args, rawData, SwaigFunctionResult) as arguments. Must return a SwaigFunctionResult, string, or object.',
              },
              required: {
                type: 'array',
                description: 'Array of required parameter names.',
              },
              prompt_description: {
                type: 'string',
                description: 'Description to include in the prompt section for this tool.',
              },
              secure: { type: 'boolean', description: 'Whether to mark the tool as secure.' },
              fillers: {
                type: 'object',
                description: 'Filler phrases for the tool.',
              },
            },
            required: ['name', 'description', 'handler_code'],
          },
        },
        prompt_title: {
          type: 'string',
          description: 'Custom title for the prompt section. Defaults to "Custom Tools".',
        },
        prompt_body: {
          type: 'string',
          description: 'Custom body text for the prompt section.',
        },
      },
    };
  }

  /**
   * Pre-compile handler code into functions during construction.
   * This catches syntax errors early and avoids re-compilation on each call.
   */
  private _compileHandlers(): void {
    const toolDefs = this._getToolDefs();

    for (const toolDef of toolDefs) {
      try {
        // The handler code receives: args, rawData, SwaigFunctionResult
        // It should return a SwaigFunctionResult, string, or plain object
        const handler = new Function(
          'args',
          'rawData',
          'SwaigFunctionResult',
          toolDef.handler_code,
        ) as (
          args: Record<string, unknown>,
          rawData: Record<string, unknown>,
          resultClass: typeof SwaigFunctionResult,
        ) => unknown;

        this._compiledHandlers.set(toolDef.name, handler);
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        this._compilationErrors.set(toolDef.name, message);
      }
    }
  }

  /**
   * Get the raw tool definitions from config.
   */
  private _getToolDefs(): CustomToolDefinition[] {
    const configData = this.config as unknown as CustomSkillsConfigData;
    return configData.tools ?? [];
  }

  /** @returns Array of dynamically generated tools from the configuration, with compiled handlers. */
  getTools(): SkillToolDefinition[] {
    const toolDefs = this._getToolDefs();
    const tools: SkillToolDefinition[] = [];

    for (const toolDef of toolDefs) {
      // Check for compilation errors
      const compError = this._compilationErrors.get(toolDef.name);
      if (compError) {
        // Still register the tool but with an error handler
        tools.push({
          name: toolDef.name,
          description: toolDef.description,
          parameters: this._buildParameters(toolDef),
          required: toolDef.required,
          secure: toolDef.secure,
          fillers: toolDef.fillers,
          handler: () => {
            return new SwaigFunctionResult(
              `Custom tool "${toolDef.name}" has a compilation error in its handler code: ${compError}. Please fix the handler_code configuration.`,
            );
          },
        });
        continue;
      }

      const compiledHandler = this._compiledHandlers.get(toolDef.name);
      if (!compiledHandler) {
        continue;
      }

      tools.push({
        name: toolDef.name,
        description: toolDef.description,
        parameters: this._buildParameters(toolDef),
        required: toolDef.required,
        secure: toolDef.secure,
        fillers: toolDef.fillers,
        handler: async (
          args: Record<string, unknown>,
          rawData: Record<string, unknown>,
        ) => {
          try {
            const result = await compiledHandler(args, rawData, SwaigFunctionResult);

            // Normalize the result
            if (result instanceof SwaigFunctionResult) {
              return result;
            }

            if (typeof result === 'string') {
              return new SwaigFunctionResult(result);
            }

            if (result && typeof result === 'object') {
              return result as Record<string, unknown>;
            }

            return new SwaigFunctionResult('Action completed.');
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Custom tool "${toolDef.name}" encountered a runtime error: ${message}`,
            );
          }
        },
      });
    }

    return tools;
  }

  /** @returns Prompt section listing all custom tools and their descriptions. */
  protected override _getPromptSections(): SkillPromptSection[] {
    const toolDefs = this._getToolDefs();
    const configData = this.config as unknown as CustomSkillsConfigData;

    if (toolDefs.length === 0) {
      return [];
    }

    const title = configData.prompt_title ?? 'Custom Tools';
    const body =
      configData.prompt_body ??
      'The following custom tools are available for use.';

    const bullets: string[] = [];

    for (const toolDef of toolDefs) {
      const compError = this._compilationErrors.get(toolDef.name);

      if (compError) {
        bullets.push(
          `${toolDef.name}: [ERROR - handler compilation failed] ${toolDef.description}`,
        );
      } else if (toolDef.prompt_description) {
        bullets.push(`${toolDef.name}: ${toolDef.prompt_description}`);
      } else {
        bullets.push(`${toolDef.name}: ${toolDef.description}`);
      }
    }

    return [
      {
        title,
        body,
        bullets,
      },
    ];
  }

  /**
   * Build tool parameters from the custom tool definition.
   */
  private _buildParameters(
    toolDef: CustomToolDefinition,
  ): Record<string, unknown> {
    if (!toolDef.parameters || toolDef.parameters.length === 0) {
      return {};
    }

    const params: Record<string, unknown> = {};
    for (const param of toolDef.parameters) {
      params[param.name] = {
        type: param.type,
        description: param.description,
      };
    }
    return params;
  }

  /**
   * Get handler compilation errors for diagnostic purposes.
   * @returns A copy of the map from tool name to error message.
   */
  getCompilationErrors(): Map<string, string> {
    return new Map(this._compilationErrors);
  }
}

/**
 * Factory function for creating CustomSkillsSkill instances.
 * @param config - Configuration containing a `tools` array of custom tool definitions.
 * @returns A new CustomSkillsSkill instance.
 */
export function createSkill(config?: SkillConfig): CustomSkillsSkill {
  return new CustomSkillsSkill(config);
}
