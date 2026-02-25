/**
 * Logger - Structured logger with env-var-based configuration.
 *
 * SIGNALWIRE_LOG_LEVEL: debug | info | warn | error (default: info)
 * SIGNALWIRE_LOG_MODE: off | stderr | auto (default: auto)
 * SIGNALWIRE_LOG_FORMAT: text | json (default: text)
 * SIGNALWIRE_LOG_COLOR: true | false (default: true when TTY and no CLI raw flags)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
/** Log severity level. */
type LogLevel = keyof typeof LEVELS;
/** Output format for log entries. */
type LogFormat = 'text' | 'json';
/** Output stream routing. */
type LogStream = 'stdout' | 'stderr';

/**
 * Detect the execution environment, matching Python SDK's detection logic.
 * @returns A tuple of [environment_name, derived_log_mode].
 */
export function getExecutionMode(): [string, 'off' | 'stderr' | 'default'] {
  if (process.env['GATEWAY_INTERFACE']) return ['cgi', 'off'];
  if (process.env['AWS_LAMBDA_FUNCTION_NAME'] || process.env['LAMBDA_TASK_ROOT']) return ['lambda', 'stderr'];
  if (process.env['FUNCTION_TARGET'] || process.env['K_SERVICE'] || process.env['GOOGLE_CLOUD_PROJECT']) return ['google_cloud_function', 'default'];
  if (process.env['AZURE_FUNCTIONS_ENVIRONMENT'] || process.env['FUNCTIONS_WORKER_RUNTIME']) return ['azure_function', 'default'];
  return ['server', 'default'];
}

/** Check process.argv for CLI flags that should disable colors. */
function cliSuppressesColor(): boolean {
  return process.argv.includes('--raw') || process.argv.includes('--dump-swml');
}

function deriveStream(mode: string | undefined): LogStream {
  if (mode === 'stderr') return 'stderr';
  return 'stdout';
}

function deriveSuppressed(mode: string | undefined): boolean {
  if (mode === 'off') return true;
  if (!mode || mode === 'auto') {
    const [, derived] = getExecutionMode();
    return derived === 'off';
  }
  return false;
}

function deriveStreamFromMode(mode: string | undefined): LogStream {
  if (mode === 'stderr') return 'stderr';
  if (!mode || mode === 'auto') {
    const [, derived] = getExecutionMode();
    if (derived === 'stderr') return 'stderr';
  }
  return 'stdout';
}

function deriveColor(): boolean {
  if (process.env['SIGNALWIRE_LOG_COLOR'] !== undefined) {
    return process.env['SIGNALWIRE_LOG_COLOR'] === 'true';
  }
  if (cliSuppressesColor()) return false;
  return process.stdout?.isTTY ?? false;
}

let globalLevel: LogLevel = (process.env['SIGNALWIRE_LOG_LEVEL'] as LogLevel) ?? 'info';
let globalSuppressed = deriveSuppressed(process.env['SIGNALWIRE_LOG_MODE']);
let globalFormat: LogFormat = (process.env['SIGNALWIRE_LOG_FORMAT'] as LogFormat) ?? 'text';
let globalColor = deriveColor();
let globalStream: LogStream = deriveStreamFromMode(process.env['SIGNALWIRE_LOG_MODE']);

// ANSI color codes
const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',  // cyan
  info: '\x1b[32m',   // green
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

// Logger cache
const loggerCache = new Map<string, Logger>();

/**
 * Set the minimum log level for all loggers.
 * @param level - The minimum severity level to emit.
 */
export function setGlobalLogLevel(level: LogLevel): void {
  globalLevel = level;
}

/**
 * Suppress or unsuppress all log output globally.
 * @param suppress - True to suppress, false to restore (default true).
 */
export function suppressAllLogs(suppress = true): void {
  globalSuppressed = suppress;
}

/**
 * Set the output format for all loggers.
 * @param format - Either 'text' (human-readable) or 'json' (structured).
 */
export function setGlobalLogFormat(format: LogFormat): void {
  globalFormat = format;
}

/**
 * Enable or disable ANSI color codes in text-format output.
 * @param enabled - True to enable colors, false to disable.
 */
export function setGlobalLogColor(enabled: boolean): void {
  globalColor = enabled;
}

/**
 * Set the output stream for all loggers.
 * @param stream - Either 'stdout' (default) or 'stderr'.
 */
export function setGlobalLogStream(stream: LogStream): void {
  globalStream = stream;
}

/** Reset all logging settings to their environment-variable-based defaults. */
export function resetLoggingConfiguration(): void {
  const mode = process.env['SIGNALWIRE_LOG_MODE'];
  globalLevel = (process.env['SIGNALWIRE_LOG_LEVEL'] as LogLevel) ?? 'info';
  globalSuppressed = deriveSuppressed(mode);
  globalFormat = (process.env['SIGNALWIRE_LOG_FORMAT'] as LogFormat) ?? 'text';
  globalColor = deriveColor();
  globalStream = deriveStreamFromMode(mode);
  loggerCache.clear();
}

/** Format a value for key=value text output. */
function formatKvValue(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (typeof v === 'string') {
    // Quote strings with spaces or special characters
    if (/[\s"=,;{}[\]]/.test(v)) return `"${v.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    return v;
  }
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/** Convert a data record to key=value pairs string. */
function formatKvPairs(data: Record<string, unknown>): string {
  return Object.entries(data)
    .map(([k, v]) => `${k}=${formatKvValue(v)}`)
    .join(' ');
}

/** Serialize Error instances in data to plain objects with message, name, stack. */
function serializeErrors(data: Record<string, unknown>): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(data)) {
    if (v instanceof Error) {
      result[k] = { message: v.message, name: v.name, stack: v.stack };
    } else {
      result[k] = v;
    }
  }
  return result;
}

/** Structured logger that respects global level, format, and color settings. */
export class Logger {
  private name: string;
  private context: Record<string, unknown>;

  /**
   * Create a new Logger instance.
   * @param name - Logger name shown in log output.
   * @param context - Optional key-value pairs included in every log entry.
   */
  constructor(name: string, context?: Record<string, unknown>) {
    this.name = name;
    this.context = context ?? {};
  }

  /**
   * Create a child logger with additional bound context fields merged into the parent's context.
   * @param context - Key-value pairs to merge into the child logger's context.
   * @returns A new Logger instance with the merged context.
   */
  bind(context: Record<string, unknown>): Logger {
    return new Logger(this.name, { ...this.context, ...context });
  }

  /**
   * Log a message at the debug level.
   * @param msg - The log message.
   * @param data - Optional structured data to include.
   */
  debug(msg: string, data?: Record<string, unknown>): void {
    this.log('debug', msg, data);
  }

  /**
   * Log a message at the info level.
   * @param msg - The log message.
   * @param data - Optional structured data to include.
   */
  info(msg: string, data?: Record<string, unknown>): void {
    this.log('info', msg, data);
  }

  /**
   * Log a message at the warn level.
   * @param msg - The log message.
   * @param data - Optional structured data to include.
   */
  warn(msg: string, data?: Record<string, unknown>): void {
    this.log('warn', msg, data);
  }

  /**
   * Log a message at the error level.
   * @param msg - The log message.
   * @param data - Optional structured data to include.
   */
  error(msg: string, data?: Record<string, unknown>): void {
    this.log('error', msg, data);
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (globalSuppressed) return;
    if (LEVELS[level] < LEVELS[globalLevel]) return;

    // Serialize Error instances before merging
    const safeData = data ? serializeErrors(data) : data;

    const merged = (safeData && Object.keys(safeData).length) || Object.keys(this.context).length
      ? { ...this.context, ...safeData }
      : undefined;

    if (globalFormat === 'json') {
      this.logJson(level, msg, merged);
    } else {
      this.logText(level, msg, merged);
    }
  }

  private logText(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    const levelStr = level.toUpperCase();
    const ts = new Date().toISOString();
    let prefix: string;
    if (globalColor) {
      prefix = `${DIM}${ts}${RESET} ${COLORS[level]}[${levelStr}]${RESET} ${DIM}[${this.name}]${RESET}`;
    } else {
      prefix = `${ts} [${levelStr}] [${this.name}]`;
    }
    const suffix = data && Object.keys(data).length ? ' ' + formatKvPairs(data) : '';
    const line = `${prefix} ${msg}${suffix}`;

    this.emit(level, line);
  }

  private logJson(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      logger: this.name,
      message: msg,
    };
    if (data && Object.keys(data).length) {
      Object.assign(entry, data);
    }
    const line = JSON.stringify(entry);

    this.emit(level, line);
  }

  private emit(level: LogLevel, line: string): void {
    if (globalStream === 'stderr') {
      console.error(line);
      return;
    }
    switch (level) {
      case 'debug': console.debug(line); break;
      case 'info': console.info(line); break;
      case 'warn': console.warn(line); break;
      case 'error': console.error(line); break;
    }
  }
}

/**
 * Create or retrieve a cached Logger instance with the given name.
 * @param name - Logger name shown in log output.
 * @returns A Logger instance (cached by name).
 */
export function getLogger(name: string): Logger {
  let logger = loggerCache.get(name);
  if (!logger) {
    logger = new Logger(name);
    loggerCache.set(name, logger);
  }
  return logger;
}
