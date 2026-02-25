/**
 * Native Vector Search Skill - In-memory document search using TF-IDF-like scoring.
 *
 * Tier 3 built-in skill: no external dependencies or API keys required.
 * Implements a simple text-matching algorithm based on word overlap scoring
 * (TF-IDF inspired) to search through a set of in-memory documents.
 * Suitable for small to medium document collections.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

/** A document entry in the in-memory search index. */
interface DocumentEntry {
  /** Unique document identifier. */
  id: string;
  /** Full text content of the document. */
  text: string;
  /** Optional metadata associated with the document. */
  metadata?: Record<string, unknown>;
}

/** A document paired with its relevance score from a search query. */
interface ScoredDocument {
  /** The matched document entry. */
  document: DocumentEntry;
  /** TF-IDF relevance score (higher is more relevant). */
  score: number;
}

/**
 * Tokenize text into lowercase words, removing punctuation and common stop words.
 * @param text - Raw text to tokenize.
 * @returns Array of meaningful word tokens.
 */
function tokenize(text: string): string[] {
  const stopWords = new Set([
    'a', 'an', 'the', 'is', 'are', 'was', 'were', 'be', 'been', 'being',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could',
    'should', 'may', 'might', 'shall', 'can', 'to', 'of', 'in', 'for',
    'on', 'with', 'at', 'by', 'from', 'as', 'into', 'through', 'during',
    'before', 'after', 'above', 'below', 'between', 'and', 'but', 'or',
    'nor', 'not', 'so', 'yet', 'both', 'either', 'neither', 'each',
    'every', 'all', 'any', 'few', 'more', 'most', 'other', 'some',
    'such', 'no', 'only', 'own', 'same', 'than', 'too', 'very',
    'just', 'because', 'if', 'when', 'where', 'how', 'what', 'which',
    'who', 'whom', 'this', 'that', 'these', 'those', 'i', 'me', 'my',
    'we', 'our', 'you', 'your', 'he', 'him', 'his', 'she', 'her',
    'it', 'its', 'they', 'them', 'their', 'about', 'up', 'out',
  ]);

  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 1 && !stopWords.has(word));
}

/**
 * Compute normalized term frequency for a list of tokens.
 * @param tokens - Array of tokenized words.
 * @returns Map from token to its normalized frequency.
 */
function termFrequency(tokens: string[]): Map<string, number> {
  const tf = new Map<string, number>();
  for (const token of tokens) {
    tf.set(token, (tf.get(token) ?? 0) + 1);
  }
  // Normalize by document length
  const len = tokens.length || 1;
  for (const [term, count] of tf) {
    tf.set(term, count / len);
  }
  return tf;
}

/**
 * Compute inverse document frequency weights for a tokenized corpus.
 * @param corpus - Array of token arrays, one per document.
 * @returns Map from token to its IDF weight.
 */
function inverseDocumentFrequency(
  corpus: string[][],
): Map<string, number> {
  const idf = new Map<string, number>();
  const numDocs = corpus.length || 1;

  // Count how many documents contain each term
  const docFreq = new Map<string, number>();
  for (const tokens of corpus) {
    const uniqueTokens = new Set(tokens);
    for (const token of uniqueTokens) {
      docFreq.set(token, (docFreq.get(token) ?? 0) + 1);
    }
  }

  for (const [term, freq] of docFreq) {
    idf.set(term, Math.log((numDocs + 1) / (freq + 1)) + 1);
  }

  return idf;
}

/**
 * Score a query against a document using TF-IDF cosine-like similarity.
 * @param queryTokens - Tokenized query words.
 * @param docTf - Pre-computed term frequency map for the document.
 * @param idf - Pre-computed inverse document frequency map.
 * @returns Similarity score (higher is more relevant).
 */
function scoreTfIdf(
  queryTokens: string[],
  docTf: Map<string, number>,
  idf: Map<string, number>,
): number {
  if (queryTokens.length === 0) return 0;

  let score = 0;
  const queryTf = termFrequency(queryTokens);

  for (const [term, qWeight] of queryTf) {
    const docWeight = docTf.get(term) ?? 0;
    const idfWeight = idf.get(term) ?? 1;
    score += qWeight * docWeight * idfWeight * idfWeight;
  }

  return score;
}

/**
 * In-memory document search using TF-IDF-like word overlap scoring.
 *
 * Tier 3 built-in skill with no external dependencies or API keys required.
 * Documents are provided via the `documents` config array and indexed at
 * construction time. Suitable for small to medium document collections.
 */
export class NativeVectorSearchSkill extends SkillBase {
  private _documents: DocumentEntry[] = [];
  private _tokenizedDocs: string[][] = [];
  private _docTfs: Map<string, number>[] = [];
  private _idf: Map<string, number> = new Map();
  private _indexed = false;

  /**
   * @param config - Optional configuration; supports `documents` array of {id, text, metadata?}.
   */
  constructor(config?: SkillConfig) {
    super('native_vector_search', config);
    this._loadDocuments();
  }

  /** @returns Manifest with config schema for the documents array. */
  getManifest(): SkillManifest {
    return {
      name: 'native_vector_search',
      description:
        'In-memory document search using TF-IDF-like word overlap scoring. No external dependencies or API keys required.',
      version: '1.0.0',
      author: 'SignalWire',
      tags: ['search', 'vector', 'tfidf', 'documents', 'local', 'knowledge'],
      configSchema: {
        documents: {
          type: 'array',
          description:
            'Array of documents to index: [{ id: string, text: string, metadata?: object }].',
        },
      },
    };
  }

  /**
   * Load and index documents from configuration.
   */
  private _loadDocuments(): void {
    const docs = this.getConfig<DocumentEntry[]>('documents', []);

    if (!Array.isArray(docs) || docs.length === 0) {
      this._documents = [];
      this._indexed = false;
      return;
    }

    this._documents = docs.filter(
      (d) => d && typeof d.id === 'string' && typeof d.text === 'string' && d.text.trim().length > 0,
    );

    // Tokenize all documents
    this._tokenizedDocs = this._documents.map((doc) => tokenize(doc.text));

    // Compute TF for each document
    this._docTfs = this._tokenizedDocs.map((tokens) => termFrequency(tokens));

    // Compute IDF across the corpus
    this._idf = inverseDocumentFrequency(this._tokenizedDocs);

    this._indexed = true;
  }

  /** @returns A single `search_documents` tool that searches indexed documents by text similarity. */
  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'search_documents',
        description:
          'Search through the indexed documents for the most relevant results matching your query. Uses text similarity scoring to rank results.',
        parameters: {
          query: {
            type: 'string',
            description: 'The search query or question.',
          },
          top_k: {
            type: 'number',
            description: 'Number of top results to return (1-20). Defaults to 3.',
          },
        },
        required: ['query'],
        handler: (args: Record<string, unknown>) => {
          const query = args.query as string | undefined;
          const topK = args.top_k as number | undefined;

          if (!query || typeof query !== 'string' || query.trim().length === 0) {
            return new SwaigFunctionResult('Please provide a search query.');
          }

          if (!this._indexed || this._documents.length === 0) {
            return new SwaigFunctionResult(
              'No documents are loaded for searching. Configure the skill with a "documents" array.',
            );
          }

          const k = Math.max(1, Math.min(20, topK ?? 3));
          const queryTokens = tokenize(query);

          if (queryTokens.length === 0) {
            return new SwaigFunctionResult(
              'The search query did not contain any meaningful search terms. Please try a more specific query.',
            );
          }

          // Score all documents
          const scored: ScoredDocument[] = this._documents.map((doc, i) => ({
            document: doc,
            score: scoreTfIdf(queryTokens, this._docTfs[i], this._idf),
          }));

          // Sort by score descending
          scored.sort((a, b) => b.score - a.score);

          // Filter out zero-score results and take top k
          const results = scored.filter((s) => s.score > 0).slice(0, k);

          if (results.length === 0) {
            return new SwaigFunctionResult(
              `No relevant documents found for "${query}". Try different search terms.`,
            );
          }

          const parts: string[] = [
            `Found ${results.length} relevant document(s) for "${query}":`,
            '',
          ];

          for (let i = 0; i < results.length; i++) {
            const { document, score } = results[i];
            const relevance = score.toFixed(4);

            parts.push(`--- Result ${i + 1} (ID: ${document.id}, relevance: ${relevance}) ---`);

            // Truncate long texts for readability
            const maxLen = 500;
            const text = document.text.trim();
            if (text.length > maxLen) {
              parts.push(text.slice(0, maxLen) + '...');
            } else {
              parts.push(text);
            }

            if (document.metadata && Object.keys(document.metadata).length > 0) {
              const metaStr = Object.entries(document.metadata)
                .map(([k, v]) => `${k}: ${String(v)}`)
                .join(', ');
              parts.push(`[Metadata: ${metaStr}]`);
            }

            parts.push('');
          }

          return new SwaigFunctionResult(parts.join('\n').trim());
        },
      },
    ];
  }

  /** @returns Prompt section describing the local document search capabilities. */
  getPromptSections(): SkillPromptSection[] {
    const docCount = this._documents.length;

    return [
      {
        title: 'Document Search',
        body: `You have access to a local collection of ${docCount} document(s) that can be searched for relevant information.`,
        bullets: [
          'Use the search_documents tool when the user asks about topics that may be covered in the indexed documents.',
          'You can specify how many results to return with the top_k parameter.',
          'Results are ranked by text relevance using word overlap scoring.',
          'Synthesize information from multiple results when appropriate.',
          'If no results are found, the query terms may not match the document content. Try different wording.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating NativeVectorSearchSkill instances.
 * @param config - Optional skill configuration.
 * @returns A new NativeVectorSearchSkill instance.
 */
export function createSkill(config?: SkillConfig): NativeVectorSearchSkill {
  return new NativeVectorSearchSkill(config);
}
