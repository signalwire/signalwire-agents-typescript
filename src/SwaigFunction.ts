/**
 * SwaigFunction - Wraps a handler function with metadata for SWAIG registration.
 */

import { SwaigFunctionResult } from './SwaigFunctionResult.js';
import { getLogger } from './Logger.js';

const log = getLogger('SwaigFunction');

/**
 * Handler function for a SWAIG tool invocation.
 * @param args - Parsed arguments extracted by the AI from user speech.
 * @param rawData - The full raw request payload from SignalWire.
 * @returns A SwaigFunctionResult, a plain object with a response key, a string, or a Promise of any of these.
 */
export type SwaigHandler = (
  args: Record<string, unknown>,
  rawData: Record<string, unknown>,
) => SwaigFunctionResult | Record<string, unknown> | string | Promise<SwaigFunctionResult | Record<string, unknown> | string>;

/** Configuration options for creating a SwaigFunction. */
export interface SwaigFunctionOptions {
  /** Unique name used to register and invoke this tool. */
  name: string;
  /** The handler function called when the tool is invoked. */
  handler: SwaigHandler;
  /** Human-readable description of what the tool does, shown to the AI. */
  description: string;
  /** JSON Schema properties describing the tool's parameters. */
  parameters?: Record<string, unknown>;
  /** Whether this tool requires session token authentication. */
  secure?: boolean;
  /** Language-keyed filler phrases spoken while the tool executes. */
  fillers?: Record<string, string[]>;
  /** Audio file URL to play while waiting for the tool to complete. */
  waitFile?: string;
  /** Number of times to loop the wait file. */
  waitFileLoops?: number;
  /** External webhook URL; makes this an externally-hosted tool. */
  webhookUrl?: string;
  /** List of required parameter names. */
  required?: string[];
  /** Additional fields to include in the SWAIG definition output. */
  extraFields?: Record<string, unknown>;
}

/**
 * Wraps a tool handler function with metadata for SWAIG registration.
 *
 * Manages the tool's name, description, parameter schema, and handler,
 * and serializes the definition into the SWAIG wire format.
 */
export class SwaigFunction {
  /** Unique name used to register and invoke this tool. */
  name: string;
  /** The handler function called when the tool is invoked. */
  handler: SwaigHandler;
  /** Human-readable description shown to the AI. */
  description: string;
  /** JSON Schema properties describing the tool's parameters. */
  parameters: Record<string, unknown>;
  /** Whether this tool requires session token authentication. */
  secure: boolean;
  /** Language-keyed filler phrases spoken while the tool executes. */
  fillers?: Record<string, string[]>;
  /** Audio file URL to play while waiting for the tool to complete. */
  waitFile?: string;
  /** Number of times to loop the wait file. */
  waitFileLoops?: number;
  /** External webhook URL; set when the tool is externally hosted. */
  webhookUrl?: string;
  /** List of required parameter names. */
  required: string[];
  /** Additional fields included in the SWAIG definition output. */
  extraFields: Record<string, unknown>;
  /** Whether this tool is externally hosted (has a webhookUrl). */
  isExternal: boolean;

  /**
   * @param opts - Configuration options for the SWAIG function.
   */
  constructor(opts: SwaigFunctionOptions) {
    this.name = opts.name;
    this.handler = opts.handler;
    this.description = opts.description;
    this.parameters = opts.parameters ?? {};
    this.secure = opts.secure ?? false;
    this.fillers = opts.fillers;
    this.waitFile = opts.waitFile;
    this.waitFileLoops = opts.waitFileLoops;
    this.webhookUrl = opts.webhookUrl;
    this.required = opts.required ?? [];
    this.extraFields = opts.extraFields ?? {};
    this.isExternal = opts.webhookUrl !== undefined;
  }

  private ensureParameterStructure(): Record<string, unknown> {
    if (!this.parameters || Object.keys(this.parameters).length === 0) {
      return { type: 'object', properties: {} };
    }
    if ('type' in this.parameters && 'properties' in this.parameters) {
      return this.parameters;
    }
    const result: Record<string, unknown> = {
      type: 'object',
      properties: this.parameters,
    };
    if (this.required.length) result['required'] = this.required;
    return result;
  }

  /**
   * Invoke the handler with the given arguments and return a serialized result.
   * @param args - Parsed arguments from the AI.
   * @param rawData - The full raw request payload.
   * @returns A serialized result dictionary suitable for the SWAIG response.
   */
  async execute(
    args: Record<string, unknown>,
    rawData?: Record<string, unknown>,
  ): Promise<Record<string, unknown>> {
    try {
      const result = await this.handler(args, rawData ?? {});
      if (result instanceof SwaigFunctionResult) {
        return result.toDict();
      }
      if (typeof result === 'object' && result !== null && 'response' in result) {
        return result as Record<string, unknown>;
      }
      if (typeof result === 'object' && result !== null) {
        return new SwaigFunctionResult('Function completed successfully').toDict();
      }
      return new SwaigFunctionResult(String(result)).toDict();
    } catch (err) {
      log.error(`Error executing SWAIG function ${this.name}: ${err}`);
      return new SwaigFunctionResult(
        "Sorry, I couldn't complete that action. Please try again or contact support if the issue persists.",
      ).toDict();
    }
  }

  /**
   * Serialize this function to the SWAIG wire format for inclusion in SWML.
   * @param baseUrl - The base URL of the agent server.
   * @param token - Optional session token for secure functions.
   * @param callId - Optional call ID for secure function URLs.
   * @returns A SWAIG function definition object.
   */
  toSwaig(baseUrl: string, token?: string, callId?: string): Record<string, unknown> {
    let url = `${baseUrl}/swaig`;
    if (token && callId) {
      url = `${url}?token=${token}&call_id=${callId}`;
    }
    const def: Record<string, unknown> = {
      function: this.name,
      description: this.description,
      parameters: this.ensureParameterStructure(),
    };
    if (url) def['web_hook_url'] = url;
    if (this.fillers && Object.keys(this.fillers).length > 0) {
      def['fillers'] = this.fillers;
    }
    if (this.waitFile) def['wait_file'] = this.waitFile;
    if (this.waitFileLoops !== undefined) def['wait_file_loops'] = this.waitFileLoops;
    Object.assign(def, this.extraFields);
    return def;
  }
}
