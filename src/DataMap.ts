/**
 * DataMap - Fluent builder for SWAIG data_map configurations.
 *
 * Creates server-side tool definitions that execute on SignalWire
 * without requiring webhook endpoints.
 */

import { SwaigFunctionResult } from './SwaigFunctionResult.js';

const ENV_PATTERN = /\$\{ENV\.([^}]+)\}/g;

function expandEnvVars(value: string): string {
  return value.replace(ENV_PATTERN, (_match, varName: string) => {
    return process.env[varName] ?? '';
  });
}

function expandEnvInObject(obj: unknown): unknown {
  if (typeof obj === 'string') return expandEnvVars(obj);
  if (Array.isArray(obj)) return obj.map(expandEnvInObject);
  if (obj && typeof obj === 'object') {
    const result: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      result[k] = expandEnvInObject(v);
    }
    return result;
  }
  return obj;
}

export class DataMap {
  functionName: string;
  private _purpose = '';
  private _parameters: Record<string, unknown> = {};
  private _expressions: Record<string, unknown>[] = [];
  private _webhooks: Record<string, unknown>[] = [];
  private _output: Record<string, unknown> | null = null;
  private _errorKeys: string[] = [];
  private _expandEnv = false;

  constructor(functionName: string) {
    this.functionName = functionName;
  }

  /** Enable ${ENV.*} variable expansion in URLs, bodies, and outputs */
  enableEnvExpansion(enabled = true): this {
    this._expandEnv = enabled;
    return this;
  }

  purpose(description: string): this {
    this._purpose = description;
    return this;
  }

  description(description: string): this {
    return this.purpose(description);
  }

  parameter(
    name: string,
    paramType: string,
    description: string,
    opts?: { required?: boolean; enum?: string[] },
  ): this {
    const paramDef: Record<string, unknown> = { type: paramType, description };
    if (opts?.enum) paramDef['enum'] = opts.enum;
    this._parameters[name] = paramDef;

    if (opts?.required) {
      if (!this._parameters['_required']) {
        this._parameters['_required'] = [];
      }
      const req = this._parameters['_required'] as string[];
      if (!req.includes(name)) req.push(name);
    }
    return this;
  }

  expression(
    testValue: string,
    pattern: string | RegExp,
    output: SwaigFunctionResult,
    nomatchOutput?: SwaigFunctionResult,
  ): this {
    const patternStr = typeof pattern === 'string' ? pattern : pattern.source;
    const expr: Record<string, unknown> = {
      string: testValue,
      pattern: patternStr,
      output: output.toDict(),
    };
    if (nomatchOutput) {
      expr['nomatch-output'] = nomatchOutput.toDict();
    }
    this._expressions.push(expr);
    return this;
  }

  webhook(
    method: string,
    url: string,
    opts?: {
      headers?: Record<string, string>;
      formParam?: string;
      inputArgsAsParams?: boolean;
      requireArgs?: string[];
    },
  ): this {
    const def: Record<string, unknown> = { url, method: method.toUpperCase() };
    if (opts?.headers) def['headers'] = opts.headers;
    if (opts?.formParam) def['form_param'] = opts.formParam;
    if (opts?.inputArgsAsParams) def['input_args_as_params'] = true;
    if (opts?.requireArgs) def['require_args'] = opts.requireArgs;
    this._webhooks.push(def);
    return this;
  }

  webhookExpressions(expressions: Record<string, unknown>[]): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting webhook expressions');
    this._webhooks[this._webhooks.length - 1]['expressions'] = expressions;
    return this;
  }

  body(data: Record<string, unknown>): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting body');
    this._webhooks[this._webhooks.length - 1]['body'] = data;
    return this;
  }

  params(data: Record<string, unknown>): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting params');
    this._webhooks[this._webhooks.length - 1]['params'] = data;
    return this;
  }

  foreach(config: {
    input_key: string;
    output_key: string;
    append: string;
    max?: number;
  }): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting foreach');
    this._webhooks[this._webhooks.length - 1]['foreach'] = config;
    return this;
  }

  output(result: SwaigFunctionResult): this {
    if (!this._webhooks.length) throw new Error('Must add webhook before setting output');
    this._webhooks[this._webhooks.length - 1]['output'] = result.toDict();
    return this;
  }

  fallbackOutput(result: SwaigFunctionResult): this {
    this._output = result.toDict();
    return this;
  }

  errorKeys(keys: string[]): this {
    if (this._webhooks.length) {
      this._webhooks[this._webhooks.length - 1]['error_keys'] = keys;
    } else {
      this._errorKeys = keys;
    }
    return this;
  }

  globalErrorKeys(keys: string[]): this {
    this._errorKeys = keys;
    return this;
  }

  /** Register this DataMap tool with an AgentBase instance */
  registerWithAgent(agent: { registerSwaigFunction(fn: Record<string, unknown>): unknown }): this {
    agent.registerSwaigFunction(this.toSwaigFunction());
    return this;
  }

  toSwaigFunction(): Record<string, unknown> {
    // Build parameter schema
    let paramSchema: Record<string, unknown>;
    const paramKeys = Object.keys(this._parameters).filter((k) => k !== '_required');
    if (paramKeys.length) {
      const properties: Record<string, unknown> = {};
      for (const k of paramKeys) {
        properties[k] = this._parameters[k];
      }
      paramSchema = { type: 'object', properties };
      const required = this._parameters['_required'] as string[] | undefined;
      if (required?.length) paramSchema['required'] = required;
    } else {
      paramSchema = { type: 'object', properties: {} };
    }

    // Build data_map
    const dataMap: Record<string, unknown> = {};
    if (this._expressions.length) dataMap['expressions'] = this._expressions;
    if (this._webhooks.length) dataMap['webhooks'] = this._webhooks;
    if (this._output) dataMap['output'] = this._output;
    if (this._errorKeys.length) dataMap['error_keys'] = this._errorKeys;

    let result: Record<string, unknown> = {
      function: this.functionName,
      description: this._purpose || `Execute ${this.functionName}`,
      parameters: paramSchema,
      data_map: dataMap,
    };

    if (this._expandEnv) {
      result = expandEnvInObject(result) as Record<string, unknown>;
    }

    return result;
  }
}

// ── Helper functions ────────────────────────────────────────────────────

export function createSimpleApiTool(opts: {
  name: string;
  url: string;
  responseTemplate: string;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean }>;
  method?: string;
  headers?: Record<string, string>;
  body?: Record<string, unknown>;
  errorKeys?: string[];
}): DataMap {
  const dm = new DataMap(opts.name);
  if (opts.parameters) {
    for (const [name, def] of Object.entries(opts.parameters)) {
      dm.parameter(name, def.type ?? 'string', def.description ?? `${name} parameter`, {
        required: def.required,
      });
    }
  }
  dm.webhook(opts.method ?? 'GET', opts.url, { headers: opts.headers });
  if (opts.body) dm.body(opts.body);
  if (opts.errorKeys) dm.errorKeys(opts.errorKeys);
  dm.output(new SwaigFunctionResult(opts.responseTemplate));
  return dm;
}

export function createExpressionTool(opts: {
  name: string;
  patterns: Record<string, [string, SwaigFunctionResult]>;
  parameters?: Record<string, { type?: string; description?: string; required?: boolean }>;
}): DataMap {
  const dm = new DataMap(opts.name);
  if (opts.parameters) {
    for (const [name, def] of Object.entries(opts.parameters)) {
      dm.parameter(name, def.type ?? 'string', def.description ?? `${name} parameter`, {
        required: def.required,
      });
    }
  }
  for (const [testValue, [pattern, result]] of Object.entries(opts.patterns)) {
    dm.expression(testValue, pattern, result);
  }
  return dm;
}
