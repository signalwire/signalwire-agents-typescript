/**
 * Info Gatherer Skill - Collects structured information from the user.
 *
 * Tier 2 built-in skill: no external dependencies required.
 * Dynamically generates a save_info tool based on configured fields.
 * Fields can have optional validation patterns and required/optional flags.
 * Useful for collecting user details like name, email, phone, address, etc.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

interface FieldDefinition {
  name: string;
  description: string;
  required?: boolean;
  validation?: string;
  type?: string;
}

interface GatheredInfo {
  [key: string]: unknown;
}

export class InfoGathererSkill extends SkillBase {
  private gatheredData: Map<string, GatheredInfo> = new Map();

  constructor(config?: SkillConfig) {
    super('info_gatherer', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'info_gatherer',
      description:
        'Collects structured information from the user based on configurable fields. Validates and stores gathered data.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['data-collection', 'form', 'information', 'utility'],
      configSchema: {
        fields: {
          type: 'array',
          description:
            'Array of field definitions to collect: { name, description, required?, validation?, type? }.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Field name (used as the parameter key).' },
              description: { type: 'string', description: 'Description of what this field collects.' },
              required: { type: 'boolean', description: 'Whether this field is required. Defaults to false.' },
              validation: {
                type: 'string',
                description: 'Optional regex pattern for validation (e.g., "^[\\\\w.+-]+@[\\\\w-]+\\\\.[\\\\w.]+$" for email).',
              },
              type: {
                type: 'string',
                description: 'Parameter type for the tool schema. Defaults to "string".',
              },
            },
            required: ['name', 'description'],
          },
        },
        purpose: {
          type: 'string',
          description:
            'A description of why this information is being collected (shown in prompt).',
        },
        confirmation_message: {
          type: 'string',
          description:
            'Custom message returned after successful info collection.',
        },
        store_globally: {
          type: 'boolean',
          description:
            'Whether to store gathered info in global data. Defaults to false.',
        },
      },
    };
  }

  getTools(): SkillToolDefinition[] {
    const fields = this.getConfig<FieldDefinition[]>('fields', []);
    const confirmationMessage = this.getConfig<string>(
      'confirmation_message',
      'Information has been saved successfully.',
    );
    const storeGlobally = this.getConfig<boolean>('store_globally', false);

    if (fields.length === 0) {
      return [];
    }

    // Build dynamic parameters from field definitions
    const parameters: Record<string, unknown> = {};
    const requiredParams: string[] = [];

    for (const field of fields) {
      parameters[field.name] = {
        type: field.type ?? 'string',
        description: field.description,
      };

      if (field.required) {
        requiredParams.push(field.name);
      }
    }

    const tools: SkillToolDefinition[] = [
      {
        name: 'save_info',
        description:
          'Save information gathered from the user. Call this once you have collected the required fields.',
        parameters,
        required: requiredParams.length > 0 ? requiredParams : undefined,
        handler: (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
          const errors: string[] = [];
          const collected: GatheredInfo = {};

          // Validate each field
          for (const field of fields) {
            const value = args[field.name];

            // Check required fields
            if (field.required) {
              if (value === undefined || value === null || (typeof value === 'string' && value.trim().length === 0)) {
                errors.push(`"${field.name}" is required but was not provided.`);
                continue;
              }
            }

            // Skip optional fields that weren't provided
            if (value === undefined || value === null) {
              continue;
            }

            // Validate against pattern if specified
            if (field.validation && typeof value === 'string') {
              try {
                const regex = new RegExp(field.validation);
                if (!regex.test(value)) {
                  errors.push(
                    `"${field.name}" value "${value}" does not match the expected format.`,
                  );
                  continue;
                }
              } catch {
                // If regex is invalid, skip validation
              }
            }

            collected[field.name] = typeof value === 'string' ? value.trim() : value;
          }

          if (errors.length > 0) {
            return new SwaigFunctionResult(
              `Could not save information due to validation errors:\n${errors.join('\n')}\nPlease correct these fields and try again.`,
            );
          }

          if (Object.keys(collected).length === 0) {
            return new SwaigFunctionResult(
              'No information was provided. Please collect at least one field before saving.',
            );
          }

          // Store the gathered data keyed by call ID if available
          const callId = (rawData['call_id'] as string | undefined) ?? 'default';
          this.gatheredData.set(callId, {
            ...this.gatheredData.get(callId),
            ...collected,
          });

          // Build confirmation with collected fields summary
          const fieldSummary = Object.entries(collected)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');

          const result = new SwaigFunctionResult(
            `${confirmationMessage} Saved: ${fieldSummary}.`,
          );

          // Optionally store in global data
          if (storeGlobally) {
            result.updateGlobalData({ gathered_info: collected });
          }

          return result;
        },
      },
      {
        name: 'get_gathered_info',
        description:
          'Retrieve previously gathered information for the current call. Useful to review what has already been collected.',
        parameters: {},
        handler: (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
          const callId = (rawData['call_id'] as string | undefined) ?? 'default';
          const info = this.gatheredData.get(callId);

          if (!info || Object.keys(info).length === 0) {
            return new SwaigFunctionResult(
              'No information has been gathered yet for this call.',
            );
          }

          const summary = Object.entries(info)
            .map(([key, val]) => `${key}: ${val}`)
            .join(', ');

          return new SwaigFunctionResult(
            `Previously gathered information: ${summary}.`,
          );
        },
      },
    ];

    return tools;
  }

  getPromptSections(): SkillPromptSection[] {
    const fields = this.getConfig<FieldDefinition[]>('fields', []);
    const purpose = this.getConfig<string | undefined>('purpose', undefined);

    if (fields.length === 0) {
      return [];
    }

    const requiredFields = fields.filter((f) => f.required);
    const optionalFields = fields.filter((f) => !f.required);

    const bullets: string[] = [];

    if (purpose) {
      bullets.push(`Purpose: ${purpose}`);
    }

    bullets.push(
      'Use the save_info tool to store information once you have collected it from the user.',
    );

    if (requiredFields.length > 0) {
      const reqNames = requiredFields.map((f) => `"${f.name}"`).join(', ');
      bullets.push(
        `Required fields (must be collected): ${reqNames}.`,
      );
    }

    if (optionalFields.length > 0) {
      const optNames = optionalFields.map((f) => `"${f.name}"`).join(', ');
      bullets.push(
        `Optional fields (collect if available): ${optNames}.`,
      );
    }

    // Add field descriptions
    for (const field of fields) {
      const reqLabel = field.required ? ' (required)' : ' (optional)';
      bullets.push(`${field.name}${reqLabel}: ${field.description}`);
    }

    bullets.push(
      'Ask for information naturally in conversation rather than as a list of questions.',
      'Use get_gathered_info to review what has already been collected.',
      'Once all required fields are gathered, call save_info to store the data.',
    );

    return [
      {
        title: 'Information Collection',
        body: 'You need to collect specific information from the user during this conversation.',
        bullets,
      },
    ];
  }

  /**
   * Get all gathered data (useful for external access after call completion).
   */
  getAllGatheredData(): Map<string, GatheredInfo> {
    return new Map(this.gatheredData);
  }

  /**
   * Clear gathered data for a specific call or all calls.
   */
  clearGatheredData(callId?: string): void {
    if (callId) {
      this.gatheredData.delete(callId);
    } else {
      this.gatheredData.clear();
    }
  }
}

/**
 * Factory function for creating InfoGathererSkill instances.
 */
export function createSkill(config?: SkillConfig): InfoGathererSkill {
  return new InfoGathererSkill(config);
}
