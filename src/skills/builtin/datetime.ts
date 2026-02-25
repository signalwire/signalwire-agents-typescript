/**
 * DateTime Skill - Provides current date/time with optional timezone support.
 *
 * Tier 1 built-in skill: no external dependencies required.
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
 * Provides the current date and time with optional timezone support.
 *
 * Tier 1 built-in skill with no external dependencies. Supports all IANA
 * timezone identifiers via the Intl.DateTimeFormat API.
 */
export class DateTimeSkill extends SkillBase {
  /**
   * @param config - Optional configuration (no config keys used by this skill).
   */
  constructor(config?: SkillConfig) {
    super('datetime', config);
  }

  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return { ...super.getParameterSchema() };
  }

  /** @returns Manifest with skill metadata and tags. */
  getManifest(): SkillManifest {
    return {
      name: 'datetime',
      description: 'Provides current date and time information with timezone support.',
      version: '1.0.0',
      tags: ['utility', 'datetime', 'timezone'],
    };
  }

  /** @returns A single `get_datetime` tool that returns the current date/time in a given timezone. */
  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'get_datetime',
        description:
          'Get the current date and time. Optionally specify a timezone to get the time in that timezone.',
        parameters: {
          timezone: {
            type: 'string',
            description:
              'IANA timezone identifier (e.g., America/New_York, Europe/London, Asia/Tokyo). Defaults to UTC if not specified.',
          },
        },
        handler: (args: Record<string, unknown>) => {
          const timezone = (args.timezone as string | undefined) ?? 'UTC';
          const now = new Date();

          try {
            const dateFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            });

            const timeFormatter = new Intl.DateTimeFormat('en-US', {
              timeZone: timezone,
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
              hour12: true,
              timeZoneName: 'short',
            });

            const dateStr = dateFormatter.format(now);
            const timeStr = timeFormatter.format(now);

            return new SwaigFunctionResult(
              `The current date and time in ${timezone} is: ${dateStr}, ${timeStr}.`,
            );
          } catch {
            return new SwaigFunctionResult(
              `Invalid timezone "${timezone}". Please use a valid IANA timezone identifier such as America/New_York, Europe/London, or Asia/Tokyo.`,
            );
          }
        },
      },
    ];
  }

  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Date and Time',
        body: 'You have the ability to check the current date and time.',
        bullets: [
          'Use the get_datetime tool to retrieve the current date and time.',
          'You can specify a timezone using IANA timezone identifiers (e.g., America/New_York, Europe/London, Asia/Tokyo).',
          'If no timezone is specified, UTC is used by default.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating DateTimeSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new DateTimeSkill instance.
 */
export function createSkill(config?: SkillConfig): DateTimeSkill {
  return new DateTimeSkill(config);
}
