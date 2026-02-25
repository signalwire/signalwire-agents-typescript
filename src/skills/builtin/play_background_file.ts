/**
 * Play Background File Skill - Controls background audio playback during calls.
 *
 * Tier 2 built-in skill: no external dependencies required.
 * Provides tools to play and stop background audio files (e.g., hold music,
 * ambient sounds) during a call using SWML playback actions.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

export class PlayBackgroundFileSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('play_background_file', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'play_background_file',
      description:
        'Controls background audio playback during calls. Play hold music, ambient sounds, or any audio file in the background.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['audio', 'playback', 'background', 'music', 'call-control'],
      configSchema: {
        default_file_url: {
          type: 'string',
          description:
            'Default audio file URL to use when no URL is specified.',
        },
        allowed_domains: {
          type: 'array',
          description:
            'List of allowed domains for audio file URLs. If set, only URLs from these domains are accepted.',
        },
      },
    };
  }

  getTools(): SkillToolDefinition[] {
    const defaultFileUrl = this.getConfig<string | undefined>(
      'default_file_url',
      undefined,
    );
    const allowedDomains = this.getConfig<string[] | undefined>(
      'allowed_domains',
      undefined,
    );

    return [
      {
        name: 'play_background',
        description:
          'Play an audio file in the background during the call. The audio will loop continuously unless stopped. Useful for hold music, ambient sounds, or background audio.',
        parameters: {
          file_url: {
            type: 'string',
            description:
              'The URL of the audio file to play (MP3, WAV, or other supported format). Must be a publicly accessible URL.',
          },
          wait: {
            type: 'boolean',
            description:
              'If true, wait for the audio file to finish playing before continuing. Defaults to false (play in background).',
          },
        },
        required: defaultFileUrl ? [] : ['file_url'],
        handler: (args: Record<string, unknown>) => {
          let fileUrl = (args.file_url as string | undefined) ?? defaultFileUrl;
          const wait = (args.wait as boolean | undefined) ?? false;

          if (!fileUrl || typeof fileUrl !== 'string' || fileUrl.trim().length === 0) {
            return new SwaigFunctionResult(
              'Please provide a file URL for the audio to play in the background.',
            );
          }

          fileUrl = fileUrl.trim();

          // Validate URL format
          try {
            const parsed = new URL(fileUrl);
            if (!['http:', 'https:'].includes(parsed.protocol)) {
              return new SwaigFunctionResult(
                'Invalid file URL. Only HTTP and HTTPS URLs are supported.',
              );
            }

            // Check allowed domains if configured
            if (allowedDomains && allowedDomains.length > 0) {
              const hostname = parsed.hostname.toLowerCase();
              const isAllowed = allowedDomains.some(
                (domain) =>
                  hostname === domain.toLowerCase() ||
                  hostname.endsWith(`.${domain.toLowerCase()}`),
              );
              if (!isAllowed) {
                return new SwaigFunctionResult(
                  `Audio files from "${parsed.hostname}" are not allowed. Allowed domains: ${allowedDomains.join(', ')}.`,
                );
              }
            }
          } catch {
            return new SwaigFunctionResult(
              `Invalid file URL: "${fileUrl}". Please provide a valid HTTP or HTTPS URL.`,
            );
          }

          const result = new SwaigFunctionResult(
            `Now playing background audio: ${fileUrl}${wait ? ' (waiting for completion)' : ''}.`,
          );
          result.playBackgroundFile(fileUrl, wait);

          return result;
        },
      },
      {
        name: 'stop_background',
        description:
          'Stop any audio file currently playing in the background. Use this when the caller is ready to resume the conversation or when background audio is no longer needed.',
        parameters: {},
        handler: () => {
          const result = new SwaigFunctionResult(
            'Background audio playback has been stopped.',
          );
          result.stopBackgroundFile();

          return result;
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    const defaultFileUrl = this.getConfig<string | undefined>(
      'default_file_url',
      undefined,
    );

    const bullets: string[] = [
      'Use the play_background tool to start playing audio in the background during a call.',
      'Use the stop_background tool to stop any currently playing background audio.',
      'Background audio is useful for hold music, ambient sounds, or playing announcements.',
      'The audio will continue playing until explicitly stopped with stop_background.',
    ];

    if (defaultFileUrl) {
      bullets.push(
        `A default audio file is configured. You can call play_background without specifying a file URL to use the default.`,
      );
    }

    return [
      {
        title: 'Background Audio Playback',
        body: 'You can control background audio playback during the call.',
        bullets,
      },
    ];
  }
}

/**
 * Factory function for creating PlayBackgroundFileSkill instances.
 */
export function createSkill(config?: SkillConfig): PlayBackgroundFileSkill {
  return new PlayBackgroundFileSkill(config);
}
