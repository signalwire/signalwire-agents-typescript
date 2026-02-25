/**
 * SWML Transfer Skill - Transfers calls using SWML transfer actions.
 *
 * Tier 2 built-in skill: no external dependencies required.
 * Supports both direct destination transfers and named pattern-based transfers.
 * Named patterns allow configuring a set of known transfer destinations
 * that the AI can use by name rather than requiring raw phone numbers or SIP URIs.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

/** A named transfer destination pattern with a friendly name and underlying address. */
interface TransferPattern {
  /** Friendly name for the destination (used by the AI to refer to it). */
  name: string;
  /** SIP URI, phone number, or agent URL to transfer to. */
  destination: string;
  /** Optional human-readable description of this destination. */
  description?: string;
}

/**
 * Transfers calls using SWML transfer actions.
 *
 * Tier 2 built-in skill with no external dependencies. Supports both direct
 * destination transfers and named pattern-based transfers configured via the
 * `patterns` config array. Optionally restricts to named destinations only
 * via `allow_arbitrary`.
 */
export class SwmlTransferSkill extends SkillBase {
  /**
   * @param config - Optional configuration; supports `patterns`, `allow_arbitrary`, `default_message`.
   */
  constructor(config?: SkillConfig) {
    super('swml_transfer', config);
  }

  /** @returns Manifest with config schema for patterns, allow_arbitrary, and default_message. */
  getManifest(): SkillManifest {
    return {
      name: 'swml_transfer',
      description:
        'Transfers calls using SWML transfer actions. Supports direct destination transfers and named pattern-based routing.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['call-control', 'transfer', 'swml', 'routing'],
      configSchema: {
        patterns: {
          type: 'array',
          description:
            'Array of named transfer patterns: { name, destination, description? }. When configured, the AI can transfer to named destinations.',
          items: {
            type: 'object',
            properties: {
              name: { type: 'string', description: 'Friendly name for the destination.' },
              destination: { type: 'string', description: 'SIP URI, phone number, or agent URL.' },
              description: { type: 'string', description: 'Optional description of this destination.' },
            },
            required: ['name', 'destination'],
          },
        },
        allow_arbitrary: {
          type: 'boolean',
          description:
            'Whether to allow transfers to arbitrary destinations not in the patterns list. Defaults to true if no patterns are configured, false if patterns are configured.',
        },
        default_message: {
          type: 'string',
          description:
            'Default message to say before transferring. Defaults to "Transferring your call now.".',
        },
      },
    };
  }

  /** @returns A `transfer_call` tool, plus `list_transfer_destinations` when patterns are configured. */
  getTools(): SkillToolDefinition[] {
    const patterns = this.getConfig<TransferPattern[]>('patterns', []);
    const defaultMessage = this.getConfig<string>(
      'default_message',
      'Transferring your call now.',
    );
    const allowArbitrary = this.getConfig<boolean | undefined>(
      'allow_arbitrary',
      undefined,
    );

    // If patterns are defined and allow_arbitrary is not explicitly set, default to false
    const canUseArbitrary =
      allowArbitrary !== undefined
        ? allowArbitrary
        : patterns.length === 0;

    // Build the pattern lookup map
    const patternMap = new Map<string, TransferPattern>();
    for (const pattern of patterns) {
      patternMap.set(pattern.name.toLowerCase(), pattern);
    }

    const tools: SkillToolDefinition[] = [
      {
        name: 'transfer_call',
        description: this._buildTransferDescription(patterns, canUseArbitrary),
        parameters: {
          destination: {
            type: 'string',
            description: this._buildDestinationDescription(patterns, canUseArbitrary),
          },
          message: {
            type: 'string',
            description:
              'An optional message to say to the caller before the transfer. If not provided, a default transfer message is used.',
          },
        },
        required: ['destination'],
        handler: (args: Record<string, unknown>) => {
          const destination = args.destination as string | undefined;
          const message = (args.message as string | undefined) ?? defaultMessage;

          if (
            !destination ||
            typeof destination !== 'string' ||
            destination.trim().length === 0
          ) {
            return new SwaigFunctionResult(
              'Please specify a destination for the transfer.',
            );
          }

          const trimmedDest = destination.trim();

          // Check if this matches a named pattern
          const matchedPattern = patternMap.get(trimmedDest.toLowerCase());

          if (matchedPattern) {
            const result = new SwaigFunctionResult(message);
            result.swmlTransfer(matchedPattern.destination, message);
            return result;
          }

          // No matching pattern - check if arbitrary transfers are allowed
          if (!canUseArbitrary) {
            const availableNames = patterns
              .map((p) => `"${p.name}"`)
              .join(', ');
            return new SwaigFunctionResult(
              `Unknown transfer destination "${trimmedDest}". Available destinations: ${availableNames}.`,
            );
          }

          // Arbitrary transfer
          const result = new SwaigFunctionResult(message);
          result.swmlTransfer(trimmedDest, message);
          return result;
        },
      },
    ];

    // Add a list_destinations tool if patterns are configured
    if (patterns.length > 0) {
      tools.push({
        name: 'list_transfer_destinations',
        description:
          'List all available named transfer destinations that calls can be routed to.',
        parameters: {},
        handler: () => {
          const lines = patterns.map((p) => {
            const desc = p.description ? ` - ${p.description}` : '';
            return `${p.name}${desc}`;
          });

          return new SwaigFunctionResult(
            `Available transfer destinations:\n${lines.join('\n')}`,
          );
        },
      });
    }

    return tools;
  }

  /** @returns Prompt section describing call transfer capabilities and available destinations. */
  getPromptSections(): SkillPromptSection[] {
    const patterns = this.getConfig<TransferPattern[]>('patterns', []);
    const allowArbitrary = this.getConfig<boolean | undefined>(
      'allow_arbitrary',
      undefined,
    );
    const canUseArbitrary =
      allowArbitrary !== undefined
        ? allowArbitrary
        : patterns.length === 0;

    const bullets: string[] = [
      'Use the transfer_call tool to transfer the current call to another destination.',
      'You can optionally provide a message to say to the caller before the transfer.',
    ];

    if (patterns.length > 0) {
      const patternNames = patterns.map((p) => `"${p.name}"`).join(', ');
      bullets.push(
        `Named transfer destinations are available: ${patternNames}. Use these names as the destination.`,
      );

      for (const pattern of patterns) {
        if (pattern.description) {
          bullets.push(`${pattern.name}: ${pattern.description}`);
        }
      }

      if (canUseArbitrary) {
        bullets.push(
          'You can also transfer to arbitrary phone numbers or SIP URIs.',
        );
      }

      bullets.push(
        'Use list_transfer_destinations to see all available named destinations.',
      );
    } else {
      bullets.push(
        'Provide a phone number, SIP URI, or agent URL as the transfer destination.',
      );
    }

    return [
      {
        title: 'Call Transfer',
        body: 'You can transfer the current call to another destination.',
        bullets,
      },
    ];
  }

  /**
   * Build the tool description based on available patterns.
   */
  private _buildTransferDescription(
    patterns: TransferPattern[],
    canUseArbitrary: boolean,
  ): string {
    if (patterns.length === 0) {
      return 'Transfer the current call to a specified destination (phone number, SIP URI, or agent URL).';
    }

    const names = patterns.map((p) => `"${p.name}"`).join(', ');
    const base = `Transfer the current call. Named destinations: ${names}.`;
    return canUseArbitrary
      ? `${base} You may also use arbitrary phone numbers or SIP URIs.`
      : base;
  }

  /**
   * Build the destination parameter description based on available patterns.
   */
  private _buildDestinationDescription(
    patterns: TransferPattern[],
    canUseArbitrary: boolean,
  ): string {
    if (patterns.length === 0) {
      return 'The transfer destination: a phone number (e.g., +15551234567), SIP URI, or agent URL.';
    }

    const names = patterns.map((p) => `"${p.name}"`).join(', ');
    return canUseArbitrary
      ? `A named destination (${names}) or an arbitrary phone number / SIP URI.`
      : `One of the named destinations: ${names}.`;
  }
}

/**
 * Factory function for creating SwmlTransferSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new SwmlTransferSkill instance.
 */
export function createSkill(config?: SkillConfig): SwmlTransferSkill {
  return new SwmlTransferSkill(config);
}
