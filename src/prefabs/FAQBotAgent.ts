/**
 * FAQBotAgent - A prefab agent that answers frequently asked questions using
 * keyword/word-overlap matching with configurable similarity thresholds
 * and optional escalation to a live agent.
 */

import { AgentBase } from '../AgentBase.js';
import { SwaigFunctionResult } from '../SwaigFunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface FAQEntry {
  /** The representative question text. */
  question: string;
  /** The answer to provide when this FAQ matches. */
  answer: string;
  /** Additional keywords to boost matching accuracy. */
  keywords?: string[];
}

export interface FAQBotConfig {
  /** Agent display name. */
  name?: string;
  /** List of FAQ entries for the knowledge base. */
  faqs: FAQEntry[];
  /** Minimum match score (0-1) for an FAQ to be considered a match. Default 0.5. */
  threshold?: number;
  /** Message spoken when no FAQ matches the query. */
  escalationMessage?: string;
  /** Phone number to transfer to on escalation. If not set, escalate tool is not registered. */
  escalationNumber?: string;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Agent ───────────────────────────────────────────────────────────────────

export class FAQBotAgent extends AgentBase {
  private faqs: FAQEntry[];
  private threshold: number;
  private escalationMessage: string;
  private escalationNumber: string | null;

  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a helpful FAQ assistant. Answer the caller\'s questions by searching the knowledge base. If you cannot find a satisfactory answer, offer to escalate to a human agent.',
    },
    {
      title: 'Rules',
      bullets: [
        'Always use the search_faq tool to find answers. Do not make up answers.',
        'If the search returns a good match, relay the answer naturally to the caller.',
        'If the match score is low or no match is found, let the caller know and offer to escalate.',
        'Be concise and helpful in your responses.',
        'If the caller asks a follow-up, search again with the new query.',
      ],
    },
  ];

  constructor(config: FAQBotConfig) {
    const agentName = config.name ?? 'FAQBot';
    super({
      name: agentName,
      ...config.agentOptions,
    });

    this.faqs = config.faqs;
    this.threshold = config.threshold ?? 0.5;
    this.escalationMessage = config.escalationMessage ?? 'I\'m sorry, I couldn\'t find an answer to your question. Let me transfer you to someone who can help.';
    this.escalationNumber = config.escalationNumber ?? null;

    // Build FAQ topics section for the prompt
    const topicBullets = this.faqs.map((faq) => {
      const kw = faq.keywords ? ` (keywords: ${faq.keywords.join(', ')})` : '';
      return `${faq.question}${kw}`;
    });
    this.promptAddSection('Available FAQ Topics', { bullets: topicBullets });

    // Add hints from FAQ keywords for speech recognition
    const allKeywords: string[] = [];
    for (const faq of this.faqs) {
      if (faq.keywords) allKeywords.push(...faq.keywords);
    }
    if (allKeywords.length > 0) {
      this.addHints(allKeywords);
    }

    // Register tools after all fields are initialized
    this.defineTools();
  }

  // ── Matching engine ───────────────────────────────────────────────────

  /**
   * Compute a word-overlap similarity score between a query and an FAQ entry.
   * Combines question text similarity and keyword overlap.
   * Returns a value between 0 and 1.
   */
  private computeMatchScore(query: string, faq: FAQEntry): number {
    const queryWords = this.tokenize(query);
    if (queryWords.length === 0) return 0;

    // Score against the question text
    const questionWords = this.tokenize(faq.question);
    const questionOverlap = this.wordOverlap(queryWords, questionWords);

    // Score against keywords
    let keywordScore = 0;
    if (faq.keywords && faq.keywords.length > 0) {
      const keywordTokens = faq.keywords.map((k) => k.toLowerCase().trim());
      const queryLower = query.toLowerCase();
      let keywordHits = 0;
      for (const kw of keywordTokens) {
        if (queryLower.includes(kw)) {
          keywordHits++;
        }
      }
      keywordScore = keywordTokens.length > 0 ? keywordHits / keywordTokens.length : 0;
    }

    // Weighted combination: 60% question overlap, 40% keyword score
    return faq.keywords && faq.keywords.length > 0
      ? questionOverlap * 0.6 + keywordScore * 0.4
      : questionOverlap;
  }

  private tokenize(text: string): string[] {
    return text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
  }

  private wordOverlap(queryWords: string[], targetWords: string[]): number {
    if (queryWords.length === 0 || targetWords.length === 0) return 0;
    const targetSet = new Set(targetWords);
    let matches = 0;
    for (const word of queryWords) {
      if (targetSet.has(word)) matches++;
    }
    // Normalize by the smaller set to be lenient
    const divisor = Math.min(queryWords.length, targetWords.length);
    return divisor > 0 ? matches / divisor : 0;
  }

  // ── Tool registration ─────────────────────────────────────────────────

  protected override defineTools(): void {
    // Tool: search_faq
    this.defineTool({
      name: 'search_faq',
      description: 'Search the FAQ knowledge base for an answer to the caller\'s question. Returns the best matching FAQ entry with a confidence score.',
      parameters: {
        type: 'object',
        properties: {
          query: {
            type: 'string',
            description: 'The caller\'s question or search query.',
          },
        },
        required: ['query'],
      },
      handler: (_args: Record<string, unknown>) => {
        const query = _args['query'] as string;
        if (!query) {
          return new SwaigFunctionResult('A query is required to search the FAQ.');
        }

        // Score all FAQs
        const scored = this.faqs.map((faq) => ({
          faq,
          score: this.computeMatchScore(query, faq),
        }));

        // Sort by score descending
        scored.sort((a, b) => b.score - a.score);

        const best = scored[0];

        if (!best || best.score < this.threshold) {
          return new SwaigFunctionResult(
            `No FAQ matched the query "${query}" with sufficient confidence (best score: ${best ? best.score.toFixed(2) : '0.00'}, threshold: ${this.threshold.toFixed(2)}). ${this.escalationMessage}`,
          );
        }

        // Return the best match
        let response = `FAQ Match (confidence: ${best.score.toFixed(2)}): Q: "${best.faq.question}" A: ${best.faq.answer}`;

        // If there are close runner-ups, mention them
        const runnerUps = scored.filter((s, i) => i > 0 && s.score >= this.threshold);
        if (runnerUps.length > 0) {
          const alsoStr = runnerUps
            .slice(0, 2)
            .map((s) => `"${s.faq.question}" (${s.score.toFixed(2)})`)
            .join(', ');
          response += ` Also related: ${alsoStr}`;
        }

        return new SwaigFunctionResult(response);
      },
    });

    // Tool: escalate (only if escalation number is configured)
    if (this.escalationNumber) {
      this.defineTool({
        name: 'escalate',
        description: 'Transfer the caller to a live agent when the FAQ knowledge base cannot answer their question.',
        parameters: {
          type: 'object',
          properties: {
            reason: {
              type: 'string',
              description: 'The reason for escalation.',
            },
          },
        },
        handler: (_args: Record<string, unknown>) => {
          const reason = (_args['reason'] as string) || 'Caller needs assistance beyond FAQ';
          const result = new SwaigFunctionResult(
            `Transferring caller to a live agent. Reason: ${reason}`,
          );
          result.connect(this.escalationNumber!);
          return result;
        },
      });
    }
  }
}

// ── Common English stop words filtered from matching ────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'is', 'it', 'to', 'in', 'of', 'and', 'or', 'for',
  'on', 'at', 'by', 'do', 'if', 'my', 'so', 'up', 'am', 'as', 'be',
  'he', 'me', 'we', 'no', 'not', 'are', 'was', 'has', 'had', 'how',
  'its', 'can', 'did', 'get', 'but', 'you', 'her', 'him', 'his', 'she',
  'our', 'who', 'this', 'that', 'what', 'with', 'have', 'from', 'will',
  'your', 'they', 'them', 'been', 'does', 'just', 'than', 'when', 'which',
  'would', 'could', 'should', 'about', 'their', 'there', 'these', 'those',
]);

// ── Factory function ────────────────────────────────────────────────────────

export function createFAQBotAgent(config: FAQBotConfig): FAQBotAgent {
  return new FAQBotAgent(config);
}

export default FAQBotAgent;
