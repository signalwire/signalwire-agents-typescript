/**
 * Logger - Structured logger with env-var-based configuration.
 *
 * SIGNALWIRE_LOG_LEVEL: debug | info | warn | error (default: info)
 * SIGNALWIRE_LOG_MODE: off to suppress all logging
 * SIGNALWIRE_LOG_FORMAT: text | json (default: text)
 * SIGNALWIRE_LOG_COLOR: true | false (default: true when TTY)
 */

const LEVELS = { debug: 0, info: 1, warn: 2, error: 3 } as const;
type LogLevel = keyof typeof LEVELS;
type LogFormat = 'text' | 'json';

let globalLevel: LogLevel = (process.env['SIGNALWIRE_LOG_LEVEL'] as LogLevel) ?? 'info';
let globalSuppressed = process.env['SIGNALWIRE_LOG_MODE'] === 'off';
let globalFormat: LogFormat = (process.env['SIGNALWIRE_LOG_FORMAT'] as LogFormat) ?? 'text';
let globalColor = process.env['SIGNALWIRE_LOG_COLOR'] !== undefined
  ? process.env['SIGNALWIRE_LOG_COLOR'] === 'true'
  : (process.stdout?.isTTY ?? false);

// ANSI color codes
const COLORS: Record<LogLevel, string> = {
  debug: '\x1b[36m',  // cyan
  info: '\x1b[32m',   // green
  warn: '\x1b[33m',   // yellow
  error: '\x1b[31m',  // red
};
const RESET = '\x1b[0m';
const DIM = '\x1b[2m';

export function setGlobalLogLevel(level: LogLevel): void {
  globalLevel = level;
}

export function suppressAllLogs(suppress = true): void {
  globalSuppressed = suppress;
}

export function setGlobalLogFormat(format: LogFormat): void {
  globalFormat = format;
}

export function setGlobalLogColor(enabled: boolean): void {
  globalColor = enabled;
}

export function resetLoggingConfiguration(): void {
  globalLevel = (process.env['SIGNALWIRE_LOG_LEVEL'] as LogLevel) ?? 'info';
  globalSuppressed = process.env['SIGNALWIRE_LOG_MODE'] === 'off';
  globalFormat = (process.env['SIGNALWIRE_LOG_FORMAT'] as LogFormat) ?? 'text';
  globalColor = process.env['SIGNALWIRE_LOG_COLOR'] !== undefined
    ? process.env['SIGNALWIRE_LOG_COLOR'] === 'true'
    : (process.stdout?.isTTY ?? false);
}

export class Logger {
  private name: string;
  private context: Record<string, unknown>;

  constructor(name: string, context?: Record<string, unknown>) {
    this.name = name;
    this.context = context ?? {};
  }

  /**
   * Create a child logger with bound context fields.
   * The returned logger inherits this logger's name and context,
   * with the new context merged in.
   */
  bind(context: Record<string, unknown>): Logger {
    return new Logger(this.name, { ...this.context, ...context });
  }

  debug(msg: string, data?: Record<string, unknown>): void {
    this.log('debug', msg, data);
  }

  info(msg: string, data?: Record<string, unknown>): void {
    this.log('info', msg, data);
  }

  warn(msg: string, data?: Record<string, unknown>): void {
    this.log('warn', msg, data);
  }

  error(msg: string, data?: Record<string, unknown>): void {
    this.log('error', msg, data);
  }

  private log(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    if (globalSuppressed) return;
    if (LEVELS[level] < LEVELS[globalLevel]) return;

    const merged = (data && Object.keys(data).length) || Object.keys(this.context).length
      ? { ...this.context, ...data }
      : undefined;

    if (globalFormat === 'json') {
      this.logJson(level, msg, merged);
    } else {
      this.logText(level, msg, merged);
    }
  }

  private logText(level: LogLevel, msg: string, data?: Record<string, unknown>): void {
    const levelStr = level.toUpperCase();
    let prefix: string;
    if (globalColor) {
      prefix = `${COLORS[level]}[${levelStr}]${RESET} ${DIM}[${this.name}]${RESET}`;
    } else {
      prefix = `[${levelStr}] [${this.name}]`;
    }
    const suffix = data && Object.keys(data).length ? ' ' + JSON.stringify(data) : '';
    const line = `${prefix} ${msg}${suffix}`;

    switch (level) {
      case 'debug': console.debug(line); break;
      case 'info': console.info(line); break;
      case 'warn': console.warn(line); break;
      case 'error': console.error(line); break;
    }
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

    switch (level) {
      case 'debug': console.debug(line); break;
      case 'info': console.info(line); break;
      case 'warn': console.warn(line); break;
      case 'error': console.error(line); break;
    }
  }
}

export function getLogger(name: string): Logger {
  return new Logger(name);
}
