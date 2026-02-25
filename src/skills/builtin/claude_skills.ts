/**
 * Claude Skills - Provides access to Anthropic's Claude AI for sub-queries.
 *
 * Tier 3 built-in skill: requires ANTHROPIC_API_KEY environment variable.
 * Allows the agent to send prompts to Claude for complex reasoning,
 * analysis, or sub-tasks that benefit from a dedicated AI query.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

interface AnthropicMessage {
  role: string;
  content: string | Array<{ type: string; text: string }>;
}

interface AnthropicResponse {
  id: string;
  type: string;
  role: string;
  content: Array<{
    type: string;
    text?: string;
  }>;
  model: string;
  stop_reason: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
  };
  error?: {
    type: string;
    message: string;
  };
}

interface AnthropicErrorResponse {
  type: 'error';
  error: {
    type: string;
    message: string;
  };
}

export class ClaudeSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('claude_skills', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'claude_skills',
      description:
        'Provides access to Anthropic Claude AI for complex reasoning, analysis, and sub-queries.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['ai', 'claude', 'anthropic', 'reasoning', 'analysis', 'external'],
      requiredEnvVars: ['ANTHROPIC_API_KEY'],
      configSchema: {
        model: {
          type: 'string',
          description: 'The Claude model to use. Defaults to "claude-sonnet-4-5-20250929".',
          default: 'claude-sonnet-4-5-20250929',
        },
        max_tokens: {
          type: 'number',
          description: 'Maximum tokens in the response. Defaults to 1024.',
          default: 1024,
        },
      },
    };
  }

  getTools(): SkillToolDefinition[] {
    const model = this.getConfig<string>('model', 'claude-sonnet-4-5-20250929');
    const maxTokens = this.getConfig<number>('max_tokens', 1024);

    return [
      {
        name: 'ask_claude',
        description:
          'Send a prompt to Claude AI for complex reasoning, analysis, summarization, or any task that benefits from dedicated AI processing. Returns Claude\'s response.',
        parameters: {
          prompt: {
            type: 'string',
            description: 'The prompt or question to send to Claude.',
          },
          system_prompt: {
            type: 'string',
            description:
              'Optional system prompt to set context or instructions for Claude.',
          },
        },
        required: ['prompt'],
        handler: async (args: Record<string, unknown>) => {
          const prompt = args.prompt as string | undefined;
          const systemPrompt = args.system_prompt as string | undefined;

          if (!prompt || typeof prompt !== 'string' || prompt.trim().length === 0) {
            return new SwaigFunctionResult('Please provide a prompt for Claude.');
          }

          const apiKey = process.env['ANTHROPIC_API_KEY'];
          if (!apiKey) {
            return new SwaigFunctionResult(
              'Claude AI is not configured. The ANTHROPIC_API_KEY environment variable is required.',
            );
          }

          try {
            const messages: AnthropicMessage[] = [
              { role: 'user', content: prompt.trim() },
            ];

            const requestBody: Record<string, unknown> = {
              model,
              max_tokens: maxTokens,
              messages,
            };

            if (systemPrompt && typeof systemPrompt === 'string' && systemPrompt.trim().length > 0) {
              requestBody['system'] = systemPrompt.trim();
            }

            const response = await fetch('https://api.anthropic.com/v1/messages', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'x-api-key': apiKey,
                'anthropic-version': '2023-06-01',
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              let errorMsg: string;
              try {
                const errorData = JSON.parse(errorText) as AnthropicErrorResponse;
                errorMsg = errorData.error?.message ?? `HTTP ${response.status}`;
              } catch {
                errorMsg = `HTTP ${response.status}: ${errorText.slice(0, 300)}`;
              }
              return new SwaigFunctionResult(
                `Claude API request failed: ${errorMsg}`,
              );
            }

            const data = (await response.json()) as AnthropicResponse;

            if (data.error) {
              return new SwaigFunctionResult(
                `Claude returned an error: ${data.error.message}`,
              );
            }

            // Extract text content from the response
            const textParts = data.content
              .filter((block) => block.type === 'text' && block.text)
              .map((block) => block.text!);

            if (textParts.length === 0) {
              return new SwaigFunctionResult(
                'Claude returned an empty response. Try rephrasing your prompt.',
              );
            }

            const responseText = textParts.join('\n\n');
            return new SwaigFunctionResult(responseText);
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to query Claude AI: ${message}`,
            );
          }
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Claude AI Assistant',
        body: 'You can delegate complex reasoning or analysis tasks to Claude AI.',
        bullets: [
          'Use the ask_claude tool for tasks requiring detailed analysis, summarization, or complex reasoning.',
          'You can provide an optional system prompt to set specific instructions or context.',
          'This is useful for tasks like: detailed explanations, code analysis, text summarization, creative writing, or multi-step reasoning.',
          'Do not use this tool for simple factual questions you already know the answer to.',
          'Summarize or relay Claude\'s response naturally to the user.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating ClaudeSkill instances.
 */
export function createSkill(config?: SkillConfig): ClaudeSkill {
  return new ClaudeSkill(config);
}
