/**
 * Types for the REST client module.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

/** Options for constructing a SignalWireClient. */
export interface ClientOptions {
  /** SignalWire project ID. Falls back to SIGNALWIRE_PROJECT_ID env var. */
  project?: string;
  /** SignalWire API token. Falls back to SIGNALWIRE_API_TOKEN env var. */
  token?: string;
  /** SignalWire space host (e.g. "example.signalwire.com"). Falls back to SIGNALWIRE_SPACE env var. */
  host?: string;
  /** Custom fetch implementation for testing. */
  fetchImpl?: typeof globalThis.fetch;
}

/** Options for constructing an HttpClient. */
export interface HttpClientOptions {
  /** Base URL (e.g. "https://example.signalwire.com"). */
  baseUrl: string;
  /** Project ID for Basic Auth username. */
  project: string;
  /** API token for Basic Auth password. */
  token: string;
  /** Custom fetch implementation for testing. */
  fetchImpl?: typeof globalThis.fetch;
}

/** Standard paginated response with links-based navigation (relay REST). */
export interface PaginatedResponse<T> {
  data: T[];
  links?: {
    first?: string;
    self?: string;
    next?: string;
    last?: string;
  };
}

/** LAML-style paginated response with next_page_uri. */
export interface LamlPaginatedResponse<T> {
  [key: string]: any;
  next_page_uri?: string | null;
  uri?: string;
  page?: number;
  page_size?: number;
}

/** Query parameters for list operations. */
export type QueryParams = Record<string, string | number | boolean | undefined>;
