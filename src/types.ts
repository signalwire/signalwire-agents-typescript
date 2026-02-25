/**
 * Shared type definitions for SignalWire AI Agents SDK.
 */

export interface AgentOptions {
  name: string;
  route?: string;
  host?: string;
  port?: number;
  basicAuth?: [string, string];
  usePom?: boolean;
  tokenExpirySecs?: number;
  autoAnswer?: boolean;
  recordCall?: boolean;
  recordFormat?: string;
  recordStereo?: boolean;
  defaultWebhookUrl?: string;
  nativeFunctions?: string[];
  agentId?: string;
  suppressLogs?: boolean;
}

export interface LanguageConfig {
  name: string;
  code: string;
  voice?: string;
  engine?: string;
  fillers?: Record<string, string[]>;
  speechModel?: string;
  functionFillers?: Record<string, Record<string, string[]>>;
}

export interface PronunciationRule {
  replace: string;
  with: string;
  ignoreCase?: boolean;
}

export interface FunctionInclude {
  url: string;
  functions: string[];
  meta_data?: Record<string, unknown>;
}

export type DynamicConfigCallback = (
  queryParams: Record<string, string>,
  bodyParams: Record<string, unknown>,
  headers: Record<string, string>,
  agent: unknown,
) => void | Promise<void>;

export type SummaryCallback = (
  summary: Record<string, unknown> | null,
  rawData: Record<string, unknown>,
) => void | Promise<void>;
