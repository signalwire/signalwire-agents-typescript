/**
 * InfoGathererAgent - A prefab agent that sequentially collects information
 * from callers through conversational interaction.
 *
 * Tracks fields per call, validates with optional regex patterns, and fires
 * an onComplete callback once all required fields are gathered.
 */

import { AgentBase } from '../AgentBase.js';
import { SwaigFunctionResult } from '../SwaigFunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface InfoGathererField {
  /** Unique field name (used as key in collected data). */
  name: string;
  /** Human-readable description shown to the AI agent. */
  description: string;
  /** Whether this field must be collected before completion. Default true. */
  required?: boolean;
  /** Optional validation pattern. String is compiled to RegExp. */
  validation?: RegExp | string;
}

export interface InfoGathererConfig {
  /** Agent display name. */
  name?: string;
  /** Fields to collect from the caller. */
  fields: InfoGathererField[];
  /** Opening message the agent speaks when call starts. */
  introMessage?: string;
  /** Message spoken after all required fields are gathered. */
  confirmationMessage?: string;
  /** Callback fired when all required fields have been collected. */
  onComplete?: (data: Record<string, string>) => void | Promise<void>;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Per-call session state ──────────────────────────────────────────────────

interface GatherSession {
  collected: Record<string, string>;
  completeFired: boolean;
}

// ── Agent ───────────────────────────────────────────────────────────────────

export class InfoGathererAgent extends AgentBase {
  private fields: InfoGathererField[];
  private introMessage: string;
  private confirmationMessage: string;
  private onCompleteCallback?: (data: Record<string, string>) => void | Promise<void>;
  private sessions: Map<string, GatherSession> = new Map();

  /**
   * Declarative prompt sections merged by AgentBase constructor.
   * Additional dynamic sections are added in the constructor body below.
   */
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are an information-gathering assistant. Your job is to collect specific pieces of information from the caller in a friendly, conversational manner.',
    },
    {
      title: 'Rules',
      bullets: [
        'Ask for one field at a time, in the order listed.',
        'If the caller provides information for a later field, accept it and move on.',
        'Always confirm each piece of information before saving it using the save_field tool.',
        'If validation fails, politely ask the caller to try again.',
        'Use the get_status tool when you need to check progress.',
        'Once all required fields are collected, summarize the information and confirm with the caller.',
      ],
    },
  ];

  constructor(config: InfoGathererConfig) {
    const agentName = config.name ?? 'InfoGatherer';
    super({
      name: agentName,
      ...config.agentOptions,
    });

    this.fields = config.fields;
    this.introMessage = config.introMessage ?? 'Hello! I need to collect some information from you. Let me walk you through it.';
    this.confirmationMessage = config.confirmationMessage ?? 'Thank you! I have collected all the required information.';
    this.onCompleteCallback = config.onComplete;

    // Build the dynamic fields section
    const fieldBullets = this.fields.map((f) => {
      const reqLabel = f.required === false ? '(optional)' : '(required)';
      const valLabel = f.validation ? ` [validation: ${f.validation instanceof RegExp ? f.validation.source : f.validation}]` : '';
      return `${f.name}: ${f.description} ${reqLabel}${valLabel}`;
    });
    this.promptAddSection('Fields to Collect', { bullets: fieldBullets, numbered: true });

    if (this.introMessage) {
      this.promptAddSection('Introduction', {
        body: `Begin the conversation with: "${this.introMessage}"`,
      });
    }

    // Hints for speech recognition
    this.addHints(this.fields.map((f) => f.name));

    // Register tools after all fields are initialized
    this.defineTools();
  }

  // ── Session helpers ───────────────────────────────────────────────────

  private getSession(rawData: Record<string, unknown>): GatherSession {
    const callId = (rawData['call_id'] as string) ?? 'default';
    let session = this.sessions.get(callId);
    if (!session) {
      session = { collected: {}, completeFired: false };
      this.sessions.set(callId, session);
    }
    return session;
  }

  private getFieldByName(name: string): InfoGathererField | undefined {
    return this.fields.find((f) => f.name.toLowerCase() === name.toLowerCase());
  }

  private validateValue(field: InfoGathererField, value: string): boolean {
    if (!field.validation) return true;
    const pattern = field.validation instanceof RegExp
      ? field.validation
      : new RegExp(field.validation);
    return pattern.test(value);
  }

  private getRequiredFields(): InfoGathererField[] {
    return this.fields.filter((f) => f.required !== false);
  }

  private allRequiredCollected(session: GatherSession): boolean {
    return this.getRequiredFields().every((f) => f.name in session.collected);
  }

  // ── Tool registration ─────────────────────────────────────────────────

  protected override defineTools(): void {
    // Tool: save_field
    this.defineTool({
      name: 'save_field',
      description: 'Save a collected field value from the caller. Validates the value if a validation pattern is configured for the field.',
      parameters: {
        type: 'object',
        properties: {
          field_name: {
            type: 'string',
            description: 'The name of the field to save.',
          },
          value: {
            type: 'string',
            description: 'The value provided by the caller.',
          },
        },
        required: ['field_name', 'value'],
      },
      handler: async (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const fieldName = args['field_name'] as string;
        const value = args['value'] as string;

        if (!fieldName || !value) {
          return new SwaigFunctionResult('Both field_name and value are required.');
        }

        const field = this.getFieldByName(fieldName);
        if (!field) {
          const available = this.fields.map((f) => f.name).join(', ');
          return new SwaigFunctionResult(
            `Unknown field "${fieldName}". Available fields: ${available}`,
          );
        }

        if (!this.validateValue(field, value)) {
          return new SwaigFunctionResult(
            `The value "${value}" is not valid for field "${field.name}". Please ask the caller to provide a valid value. Expected format: ${field.validation instanceof RegExp ? field.validation.source : field.validation}`,
          );
        }

        const session = this.getSession(rawData);
        session.collected[field.name] = value;

        // Check if all required fields are now collected
        if (this.allRequiredCollected(session) && !session.completeFired) {
          session.completeFired = true;
          if (this.onCompleteCallback) {
            try {
              await this.onCompleteCallback({ ...session.collected });
            } catch (err) {
              this.log.error(`onComplete callback error: ${err}`);
            }
          }
          const collectedSummary = Object.entries(session.collected)
            .map(([k, v]) => `${k}: ${v}`)
            .join(', ');
          return new SwaigFunctionResult(
            `Field "${field.name}" saved successfully. All required fields are now collected! Summary: ${collectedSummary}. ${this.confirmationMessage}`,
          );
        }

        // Determine remaining fields
        const remaining = this.fields
          .filter((f) => f.required !== false && !(f.name in session.collected))
          .map((f) => f.name);

        return new SwaigFunctionResult(
          `Field "${field.name}" saved as "${value}". Remaining required fields: ${remaining.length > 0 ? remaining.join(', ') : 'none'}.`,
        );
      },
    });

    // Tool: get_status
    this.defineTool({
      name: 'get_status',
      description: 'Get the current status of information gathering, showing which fields have been collected and which remain.',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const session = this.getSession(rawData);

        const collectedEntries = Object.entries(session.collected);
        const collectedStr = collectedEntries.length > 0
          ? collectedEntries.map(([k, v]) => `${k}: ${v}`).join(', ')
          : 'none';

        const remainingRequired = this.getRequiredFields()
          .filter((f) => !(f.name in session.collected))
          .map((f) => f.name);

        const remainingOptional = this.fields
          .filter((f) => f.required === false && !(f.name in session.collected))
          .map((f) => f.name);

        let status = `Collected: ${collectedStr}.`;
        if (remainingRequired.length > 0) {
          status += ` Remaining required: ${remainingRequired.join(', ')}.`;
        } else {
          status += ' All required fields have been collected!';
        }
        if (remainingOptional.length > 0) {
          status += ` Optional fields not yet collected: ${remainingOptional.join(', ')}.`;
        }

        return new SwaigFunctionResult(status);
      },
    });
  }
}

// ── Factory function ────────────────────────────────────────────────────────

export function createInfoGathererAgent(config: InfoGathererConfig): InfoGathererAgent {
  return new InfoGathererAgent(config);
}

export default InfoGathererAgent;
