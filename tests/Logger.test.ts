import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, getLogger, setGlobalLogLevel, suppressAllLogs, setGlobalLogFormat, setGlobalLogColor, setGlobalLogStream, resetLoggingConfiguration, getExecutionMode } from '../src/Logger.js';

describe('Logger', () => {
  let spyDebug: ReturnType<typeof vi.spyOn>;
  let spyInfo: ReturnType<typeof vi.spyOn>;
  let spyWarn: ReturnType<typeof vi.spyOn>;
  let spyError: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    spyDebug = vi.spyOn(console, 'debug').mockImplementation(() => {});
    spyInfo = vi.spyOn(console, 'info').mockImplementation(() => {});
    spyWarn = vi.spyOn(console, 'warn').mockImplementation(() => {});
    spyError = vi.spyOn(console, 'error').mockImplementation(() => {});
    setGlobalLogLevel('debug');
    setGlobalLogColor(false);
    setGlobalLogFormat('text');
    setGlobalLogStream('stdout');
    suppressAllLogs(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    // Clean up env vars that tests may set
    delete process.env['GATEWAY_INTERFACE'];
    delete process.env['AWS_LAMBDA_FUNCTION_NAME'];
    delete process.env['LAMBDA_TASK_ROOT'];
    delete process.env['FUNCTION_TARGET'];
    delete process.env['K_SERVICE'];
    delete process.env['GOOGLE_CLOUD_PROJECT'];
    delete process.env['AZURE_FUNCTIONS_ENVIRONMENT'];
    delete process.env['FUNCTIONS_WORKER_RUNTIME'];
    setGlobalLogLevel('info');
    setGlobalLogFormat('text');
    setGlobalLogColor(false);
    setGlobalLogStream('stdout');
    suppressAllLogs(false);
    resetLoggingConfiguration();
  });

  it('getLogger returns Logger instance', () => {
    const log = getLogger('test-unique-1');
    expect(log).toBeInstanceOf(Logger);
  });

  it('logs at debug level with timestamp', () => {
    const log = new Logger('mymod');
    log.debug('hello');
    const output = spyDebug.mock.calls[0][0] as string;
    expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    expect(output).toContain('[DEBUG] [mymod] hello');
  });

  it('logs at info level with timestamp', () => {
    const log = new Logger('mymod');
    log.info('world');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    expect(output).toContain('[INFO] [mymod] world');
  });

  it('logs at warn level', () => {
    const log = new Logger('mymod');
    log.warn('caution');
    const output = spyWarn.mock.calls[0][0] as string;
    expect(output).toContain('[WARN] [mymod] caution');
  });

  it('logs at error level', () => {
    const log = new Logger('mymod');
    log.error('failure');
    const output = spyError.mock.calls[0][0] as string;
    expect(output).toContain('[ERROR] [mymod] failure');
  });

  it('includes data as key=value pairs in text output', () => {
    const log = new Logger('test');
    log.info('msg', { key: 'val' });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('key=val');
  });

  it('respects log level filtering', () => {
    setGlobalLogLevel('warn');
    const log = new Logger('test');
    log.debug('hidden');
    log.info('hidden');
    log.warn('shown');
    log.error('shown');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).toHaveBeenCalledOnce();
    expect(spyError).toHaveBeenCalledOnce();
  });

  it('setGlobalLogLevel changes level', () => {
    setGlobalLogLevel('error');
    const log = new Logger('test');
    log.warn('nope');
    log.error('yes');
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledOnce();
  });

  it('suppressAllLogs suppresses everything', () => {
    suppressAllLogs(true);
    const log = new Logger('test');
    log.debug('nope');
    log.info('nope');
    log.warn('nope');
    log.error('nope');
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  it('suppressAllLogs can be turned off', () => {
    suppressAllLogs(true);
    const log = new Logger('test');
    log.info('hidden');
    expect(spyInfo).not.toHaveBeenCalled();
    suppressAllLogs(false);
    log.info('shown');
    expect(spyInfo).toHaveBeenCalledOnce();
  });

  it('empty data object does not append to output', () => {
    const log = new Logger('test');
    log.info('clean', {});
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('[INFO] [test] clean');
    // Should not have trailing key=value data
    expect(output.endsWith('clean')).toBe(true);
  });

  it('debug level shows all messages', () => {
    setGlobalLogLevel('debug');
    const log = new Logger('test');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(spyDebug).toHaveBeenCalledOnce();
    expect(spyInfo).toHaveBeenCalledOnce();
    expect(spyWarn).toHaveBeenCalledOnce();
    expect(spyError).toHaveBeenCalledOnce();
  });

  // ── Pass 2: New logger features ──────────────────────────────────

  it('JSON format outputs structured JSON', () => {
    setGlobalLogFormat('json');
    const log = new Logger('mymod');
    log.info('hello world');
    expect(spyInfo).toHaveBeenCalledOnce();
    const output = spyInfo.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('info');
    expect(parsed.logger).toBe('mymod');
    expect(parsed.message).toBe('hello world');
    expect(parsed.timestamp).toBeDefined();
  });

  it('JSON format includes data fields', () => {
    setGlobalLogFormat('json');
    const log = new Logger('test');
    log.warn('alert', { code: 500, path: '/api' });
    const output = spyWarn.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.code).toBe(500);
    expect(parsed.path).toBe('/api');
  });

  it('bind creates child logger with context', () => {
    const log = new Logger('test');
    const child = log.bind({ callId: 'call-42', function: 'get_time' });
    child.info('processing');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('callId=call-42');
    expect(output).toContain('function=get_time');
  });

  it('bind context merges with log data', () => {
    const log = new Logger('test').bind({ callId: 'c1' });
    log.info('msg', { extra: true });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('callId=c1');
    expect(output).toContain('extra=true');
  });

  it('bind context can be chained', () => {
    const log = new Logger('test')
      .bind({ callId: 'c1' })
      .bind({ step: 'auth' });
    log.info('ok');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('callId=c1');
    expect(output).toContain('step=auth');
  });

  it('color output includes ANSI codes', () => {
    setGlobalLogColor(true);
    const log = new Logger('test');
    log.info('colorful');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('\x1b[32m'); // green for info
    expect(output).toContain('\x1b[0m'); // reset
  });

  it('no ANSI codes when color disabled', () => {
    setGlobalLogColor(false);
    const log = new Logger('test');
    log.error('plain');
    const output = spyError.mock.calls[0][0] as string;
    expect(output).not.toContain('\x1b[');
  });

  it('resetLoggingConfiguration restores defaults', () => {
    setGlobalLogLevel('error');
    setGlobalLogFormat('json');
    suppressAllLogs(true);
    resetLoggingConfiguration();
    // After reset, should use env vars or defaults
    const log = new Logger('test');
    log.info('after reset');
    // Since logs were re-enabled and level reset to 'info', this should log
    expect(spyInfo).toHaveBeenCalledOnce();
  });

  it('JSON format in bind context', () => {
    setGlobalLogFormat('json');
    const log = new Logger('test').bind({ reqId: 'r1' });
    log.debug('check');
    const output = spyDebug.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.reqId).toBe('r1');
    expect(parsed.message).toBe('check');
  });

  // ── Pass 3: Logging parity features ──────────────────────────────

  it('timestamp appears in text output as ISO format prefix', () => {
    const log = new Logger('ts-test');
    log.info('check');
    const output = spyInfo.mock.calls[0][0] as string;
    // ISO timestamp: 2025-01-15T10:30:00.000Z
    expect(output).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z/);
  });

  it('stderr mode routes all levels through console.error', () => {
    setGlobalLogStream('stderr');
    const log = new Logger('stderr-test');
    log.debug('d');
    log.info('i');
    log.warn('w');
    log.error('e');
    expect(spyError).toHaveBeenCalledTimes(4);
    expect(spyDebug).not.toHaveBeenCalled();
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyWarn).not.toHaveBeenCalled();
  });

  it('auto mode with GATEWAY_INTERFACE suppresses logging', () => {
    process.env['GATEWAY_INTERFACE'] = 'CGI/1.1';
    resetLoggingConfiguration();
    setGlobalLogLevel('debug');
    const log = new Logger('cgi-test');
    log.info('should be suppressed');
    expect(spyInfo).not.toHaveBeenCalled();
    expect(spyError).not.toHaveBeenCalled();
  });

  it('auto mode with AWS_LAMBDA_FUNCTION_NAME uses stderr', () => {
    process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'my-func';
    resetLoggingConfiguration();
    setGlobalLogLevel('debug');
    const log = new Logger('lambda-test');
    log.info('lambda log');
    // In stderr mode, all output goes through console.error
    expect(spyError).toHaveBeenCalledOnce();
    expect(spyInfo).not.toHaveBeenCalled();
  });

  it('Error objects in data are serialized with message and stack', () => {
    const err = new Error('test error');
    const log = new Logger('err-test');
    setGlobalLogFormat('json');
    log.error('failed', { error: err });
    const output = spyError.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.error).toBeDefined();
    expect(parsed.error.message).toBe('test error');
    expect(parsed.error.name).toBe('Error');
    expect(parsed.error.stack).toBeDefined();
  });

  it('Error objects in text mode are serialized as JSON in key=value output', () => {
    const err = new Error('oops');
    const log = new Logger('err-test');
    log.error('failed', { error: err });
    const output = spyError.mock.calls[0][0] as string;
    // Error should be serialized as an object, shown as JSON value
    expect(output).toContain('error=');
    expect(output).toContain('"message":"oops"');
  });

  it('Logger caching: getLogger returns same instance for same name', () => {
    resetLoggingConfiguration();
    const a = getLogger('cached-test');
    const b = getLogger('cached-test');
    expect(a).toBe(b);
  });

  it('Logger caching: different names return different instances', () => {
    resetLoggingConfiguration();
    const a = getLogger('cache-a');
    const b = getLogger('cache-b');
    expect(a).not.toBe(b);
  });

  it('resetLoggingConfiguration clears logger cache', () => {
    const a = getLogger('cache-clear-test');
    resetLoggingConfiguration();
    const b = getLogger('cache-clear-test');
    expect(a).not.toBe(b);
  });

  it('key=value text formatting for simple data', () => {
    const log = new Logger('kv-test');
    log.info('op', { count: 5, status: 'ok' });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('count=5');
    expect(output).toContain('status=ok');
  });

  it('quoted values for strings with spaces', () => {
    const log = new Logger('kv-test');
    log.info('op', { msg: 'hello world' });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('msg="hello world"');
  });

  it('nested objects use JSON in key=value mode', () => {
    const log = new Logger('kv-test');
    log.info('op', { nested: { a: 1 } });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('nested={"a":1}');
  });

  it('arrays use JSON in key=value mode', () => {
    const log = new Logger('kv-test');
    log.info('op', { items: [1, 2, 3] });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('items=[1,2,3]');
  });

  it('color mode includes DIM timestamp', () => {
    setGlobalLogColor(true);
    const log = new Logger('color-ts');
    log.info('check');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('\x1b[2m'); // DIM for timestamp
    expect(output).toContain('\x1b[32m'); // green for INFO
  });

  it('getExecutionMode returns server by default', () => {
    const [env, mode] = getExecutionMode();
    expect(env).toBe('server');
    expect(mode).toBe('default');
  });

  it('getExecutionMode detects CGI', () => {
    process.env['GATEWAY_INTERFACE'] = 'CGI/1.1';
    const [env, mode] = getExecutionMode();
    expect(env).toBe('cgi');
    expect(mode).toBe('off');
  });

  it('getExecutionMode detects Lambda', () => {
    process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'test-fn';
    const [env, mode] = getExecutionMode();
    expect(env).toBe('lambda');
    expect(mode).toBe('stderr');
  });

  it('getExecutionMode detects Google Cloud', () => {
    process.env['K_SERVICE'] = 'my-service';
    const [env, mode] = getExecutionMode();
    expect(env).toBe('google_cloud_function');
    expect(mode).toBe('default');
  });

  it('getExecutionMode detects Azure', () => {
    process.env['AZURE_FUNCTIONS_ENVIRONMENT'] = 'Production';
    const [env, mode] = getExecutionMode();
    expect(env).toBe('azure_function');
    expect(mode).toBe('default');
  });

  it('stderr mode routes JSON output through console.error too', () => {
    setGlobalLogFormat('json');
    setGlobalLogStream('stderr');
    const log = new Logger('stderr-json');
    log.info('json msg');
    expect(spyError).toHaveBeenCalledOnce();
    expect(spyInfo).not.toHaveBeenCalled();
    const output = spyError.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.message).toBe('json msg');
  });

  it('null and undefined values are rendered in key=value mode', () => {
    const log = new Logger('kv-test');
    log.info('op', { a: null as any, b: undefined as any });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('a=null');
    expect(output).toContain('b=undefined');
  });
});
