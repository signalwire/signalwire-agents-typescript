/**
 * Spider Skill - Scrapes webpage content using the Spider API.
 *
 * Tier 3 built-in skill: requires SPIDER_API_KEY environment variable.
 * Uses the Spider API to fetch and extract content from web pages,
 * optionally filtering by CSS selector.
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
import { resolveAndValidateUrl, MAX_SKILL_INPUT_LENGTH } from '../../SecurityUtils.js';

/** A single crawl result from the Spider API. */
interface SpiderResult {
  /** Raw HTML content of the page. */
  content?: string;
  /** Markdown-formatted content. */
  markdown?: string;
  /** Plain text content. */
  text?: string;
  /** Resolved URL of the crawled page. */
  url?: string;
  /** HTTP status code of the crawl. */
  status?: number;
  /** Error message if the crawl failed. */
  error?: string;
}

/** Response from the Spider API, which may be an array, single result, or error object. */
type SpiderResponse = SpiderResult[] | SpiderResult | { error: string; message?: string };

/**
 * Scrapes webpage content using the Spider API.
 *
 * Tier 3 built-in skill. Requires the `SPIDER_API_KEY` environment variable.
 * Extracts text, markdown, or HTML from any public URL, with optional CSS
 * selector filtering. Supports `max_content_length` config option.
 */
export class SpiderSkill extends SkillBase {
  static override getParameterSchema(): Record<string, ParameterSchemaEntry> {
    return {
      ...super.getParameterSchema(),
      api_key: {
        type: 'string',
        description: 'Spider API key.',
        hidden: true,
        env_var: 'SPIDER_API_KEY',
        required: true,
      },
      max_content_length: {
        type: 'number',
        description: 'Maximum length of returned content in characters.',
        default: 5000,
      },
    };
  }

  /**
   * @param config - Optional configuration; supports `max_content_length`.
   */
  constructor(config?: SkillConfig) {
    super('spider', config);
  }

  /** @returns Manifest declaring SPIDER_API_KEY as required and config schema for max_content_length. */
  getManifest(): SkillManifest {
    return {
      name: 'spider',
      description:
        'Scrapes webpage content using the Spider API. Extracts text, markdown, or HTML from any public URL.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['scraping', 'web', 'spider', 'content', 'extraction', 'external'],
      requiredEnvVars: ['SPIDER_API_KEY'],
      configSchema: {
        max_content_length: {
          type: 'number',
          description:
            'Maximum length of returned content in characters. Defaults to 5000.',
          default: 5000,
        },
      },
    };
  }

  /** @returns A single `scrape_url` tool that extracts content from a web page. */
  getTools(): SkillToolDefinition[] {
    const maxContentLength = this.getConfig<number>('max_content_length', 5000);

    return [
      {
        name: 'scrape_url',
        description:
          'Scrape and extract content from a web page URL. Returns the page text or markdown content.',
        parameters: {
          url: {
            type: 'string',
            description: 'The full URL of the web page to scrape (must start with http:// or https://).',
          },
          selector: {
            type: 'string',
            description:
              'Optional CSS selector to extract specific content from the page (e.g., "article", ".main-content", "#body").',
          },
        },
        required: ['url'],
        handler: async (args: Record<string, unknown>) => {
          const url = args.url as string | undefined;
          const selector = args.selector as string | undefined;

          if (!url || typeof url !== 'string' || url.trim().length === 0) {
            return new SwaigFunctionResult('Please provide a URL to scrape.');
          }

          if (url.length > MAX_SKILL_INPUT_LENGTH) {
            return new SwaigFunctionResult('Input URL is too long.');
          }

          const trimmedUrl = url.trim();
          if (!trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
            return new SwaigFunctionResult(
              'Invalid URL. Please provide a full URL starting with http:// or https://.',
            );
          }

          // SSRF protection: validate URL does not resolve to a private IP
          const allowPrivate = process.env['SWML_ALLOW_PRIVATE_URLS'] === 'true';
          try {
            await resolveAndValidateUrl(trimmedUrl, allowPrivate);
          } catch (err) {
            return new SwaigFunctionResult(
              `URL validation failed: ${err instanceof Error ? err.message : String(err)}`,
            );
          }

          const apiKey = process.env['SPIDER_API_KEY'];
          if (!apiKey) {
            return new SwaigFunctionResult(
              'Service is not configured. Please contact your administrator.',
            );
          }

          try {
            const requestBody: Record<string, unknown> = {
              url: trimmedUrl,
              return_format: 'markdown',
            };

            if (selector && typeof selector === 'string' && selector.trim().length > 0) {
              requestBody['css_selector'] = selector.trim();
            }

            const response = await fetch('https://api.spider.cloud/crawl', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${apiKey}`,
              },
              body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
              const errorText = await response.text();
              return new SwaigFunctionResult(
                `Spider API returned an error (HTTP ${response.status}): ${errorText.slice(0, 300)}`,
              );
            }

            const data = (await response.json()) as SpiderResponse;

            // Handle error responses
            if (!Array.isArray(data) && 'error' in data) {
              return new SwaigFunctionResult(
                `Spider scraping failed: ${data.error}`,
              );
            }

            // Extract content from result
            let content = '';
            const result: SpiderResult = Array.isArray(data) ? data[0] : data;

            if (!result) {
              return new SwaigFunctionResult(
                `No content could be extracted from "${trimmedUrl}".`,
              );
            }

            if (result.error) {
              return new SwaigFunctionResult(
                `Error scraping "${trimmedUrl}": ${result.error}`,
              );
            }

            // Prefer markdown > text > content
            content = result.markdown ?? result.text ?? result.content ?? '';

            if (content.trim().length === 0) {
              return new SwaigFunctionResult(
                `The page at "${trimmedUrl}" returned no extractable content.`,
              );
            }

            // Truncate if necessary
            let truncated = false;
            if (content.length > maxContentLength) {
              content = content.slice(0, maxContentLength);
              truncated = true;
            }

            const parts: string[] = [
              `Content from ${trimmedUrl}:`,
              '',
              content.trim(),
            ];

            if (truncated) {
              parts.push('');
              parts.push(`[Content truncated to ${maxContentLength} characters]`);
            }

            return new SwaigFunctionResult(parts.join('\n'));
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Failed to scrape "${trimmedUrl}": ${message}`,
            );
          }
        },
      },
    ];
  }

  /** @returns Prompt section describing web scraping capabilities and content limits. */
  protected override _getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Web Page Scraping',
        body: 'You can scrape and extract content from web pages.',
        bullets: [
          'Use the scrape_url tool to fetch content from any public web page.',
          'Provide a full URL starting with http:// or https://.',
          'Optionally specify a CSS selector to extract specific parts of the page.',
          'Content is returned as markdown text for easy reading.',
          `Content is limited to ${this.getConfig<number>('max_content_length', 5000)} characters.`,
          'Summarize the scraped content for the user rather than reading it verbatim.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating SpiderSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new SpiderSkill instance.
 */
export function createSkill(config?: SkillConfig): SpiderSkill {
  return new SpiderSkill(config);
}
