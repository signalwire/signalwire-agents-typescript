/**
 * Shared type definitions for SignalWire AI Agents SDK.
 */

/** Configuration options for constructing an AgentBase instance. */
export interface AgentOptions {
  /** Display name of the agent, also used as default basic-auth username when credentials are auto-generated. */
  name: string;
  /** HTTP route path the agent listens on (defaults to "/"). */
  route?: string;
  /** Hostname to bind the HTTP server to (defaults to "0.0.0.0"). */
  host?: string;
  /** Port number for the HTTP server (defaults to env PORT or 3000). */
  port?: number;
  /** Explicit basic-auth credentials as [username, password]; auto-generated if omitted. */
  basicAuth?: [string, string];
  /** Whether to use POM-based prompt rendering (defaults to true). */
  usePom?: boolean;
  /** Session token expiry in seconds (defaults to 3600). */
  tokenExpirySecs?: number;
  /** Whether to automatically insert an "answer" verb in the SWML call flow (defaults to true). */
  autoAnswer?: boolean;
  /** Whether to record the call (defaults to false). */
  recordCall?: boolean;
  /** Recording format, e.g. "mp4" (defaults to "mp4"). */
  recordFormat?: string;
  /** Whether to record in stereo (defaults to true). */
  recordStereo?: boolean;
  /** Default webhook URL for SWAIG function callbacks. */
  defaultWebhookUrl?: string;
  /** List of native function names to include in the SWAIG configuration. */
  nativeFunctions?: string[];
  /** Unique identifier for this agent instance; auto-generated if omitted. */
  agentId?: string;
  /** When true, suppresses all log output. */
  suppressLogs?: boolean;
}

/** Configuration for a supported language in the AI agent. */
export interface LanguageConfig {
  /** Human-readable language name (e.g. "English"). */
  name: string;
  /** BCP-47 language code (e.g. "en-US"). */
  code: string;
  /** Voice identifier to use for this language. */
  voice?: string;
  /** TTS engine identifier. */
  engine?: string;
  /** Filler phrases keyed by category for this language. */
  fillers?: Record<string, string[]>;
  /** Speech recognition model identifier. */
  speechModel?: string;
  /** Per-function filler phrases, keyed by function name then language code. */
  functionFillers?: Record<string, Record<string, string[]>>;
}

/** Rule for overriding how the TTS engine pronounces a specific word or phrase. */
export interface PronunciationRule {
  /** The text pattern to match. */
  replace: string;
  /** The replacement pronunciation. */
  with: string;
  /** Whether the match should be case-insensitive. */
  ignoreCase?: boolean;
}

/** Reference to an external SWAIG function endpoint to include in the AI configuration. */
export interface FunctionInclude {
  /** URL of the remote SWAIG endpoint. */
  url: string;
  /** List of function names available at the remote endpoint. */
  functions: string[];
  /** Optional metadata to pass along with the include. */
  meta_data?: Record<string, unknown>;
}

/**
 * Callback invoked on each SWML request to dynamically modify an ephemeral copy of the agent.
 * @param queryParams - URL query parameters from the incoming request.
 * @param bodyParams - Parsed JSON body of the incoming request.
 * @param headers - HTTP headers from the incoming request.
 * @param agent - Ephemeral AgentBase copy that can be mutated without affecting the original.
 */
export type DynamicConfigCallback = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
  agent: unknown,
) => void | Promise<void>;

/**
 * Callback invoked when a post-prompt summary is received at the end of a call.
 * @param summary - Parsed summary object, or null if extraction failed.
 * @param rawData - The full raw post-prompt payload.
 */
export type SummaryCallback = (
  summary: Record<string, unknown> | null,
  rawData: Record<string, unknown>,
) => void | Promise<void>;
