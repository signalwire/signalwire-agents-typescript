import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Logger, getLogger, setGlobalLogLevel, suppressAllLogs, setGlobalLogFormat, setGlobalLogColor, resetLoggingConfiguration } from '../src/Logger.js';

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
    suppressAllLogs(false);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    setGlobalLogLevel('info');
    setGlobalLogFormat('text');
    setGlobalLogColor(false);
    suppressAllLogs(false);
  });

  it('getLogger returns Logger instance', () => {
    const log = getLogger('test');
    expect(log).toBeInstanceOf(Logger);
  });

  it('logs at debug level', () => {
    const log = getLogger('mymod');
    log.debug('hello');
    expect(spyDebug).toHaveBeenCalledWith('[DEBUG] [mymod] hello');
  });

  it('logs at info level', () => {
    const log = getLogger('mymod');
    log.info('world');
    expect(spyInfo).toHaveBeenCalledWith('[INFO] [mymod] world');
  });

  it('logs at warn level', () => {
    const log = getLogger('mymod');
    log.warn('caution');
    expect(spyWarn).toHaveBeenCalledWith('[WARN] [mymod] caution');
  });

  it('logs at error level', () => {
    const log = getLogger('mymod');
    log.error('failure');
    expect(spyError).toHaveBeenCalledWith('[ERROR] [mymod] failure');
  });

  it('includes data object in output', () => {
    const log = getLogger('test');
    log.info('msg', { key: 'val' });
    expect(spyInfo).toHaveBeenCalledWith('[INFO] [test] msg {"key":"val"}');
  });

  it('respects log level filtering', () => {
    setGlobalLogLevel('warn');
    const log = getLogger('test');
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
    const log = getLogger('test');
    log.warn('nope');
    log.error('yes');
    expect(spyWarn).not.toHaveBeenCalled();
    expect(spyError).toHaveBeenCalledOnce();
  });

  it('suppressAllLogs suppresses everything', () => {
    suppressAllLogs(true);
    const log = getLogger('test');
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
    const log = getLogger('test');
    log.info('hidden');
    expect(spyInfo).not.toHaveBeenCalled();
    suppressAllLogs(false);
    log.info('shown');
    expect(spyInfo).toHaveBeenCalledOnce();
  });

  it('empty data object does not append to output', () => {
    const log = getLogger('test');
    log.info('clean', {});
    expect(spyInfo).toHaveBeenCalledWith('[INFO] [test] clean');
  });

  it('debug level shows all messages', () => {
    setGlobalLogLevel('debug');
    const log = getLogger('test');
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
    const log = getLogger('mymod');
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
    const log = getLogger('test');
    log.warn('alert', { code: 500, path: '/api' });
    const output = spyWarn.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.code).toBe(500);
    expect(parsed.path).toBe('/api');
  });

  it('bind creates child logger with context', () => {
    const log = getLogger('test');
    const child = log.bind({ callId: 'call-42', function: 'get_time' });
    child.info('processing');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('"callId":"call-42"');
    expect(output).toContain('"function":"get_time"');
  });

  it('bind context merges with log data', () => {
    const log = getLogger('test').bind({ callId: 'c1' });
    log.info('msg', { extra: true });
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('"callId":"c1"');
    expect(output).toContain('"extra":true');
  });

  it('bind context can be chained', () => {
    const log = getLogger('test')
      .bind({ callId: 'c1' })
      .bind({ step: 'auth' });
    log.info('ok');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('"callId":"c1"');
    expect(output).toContain('"step":"auth"');
  });

  it('color output includes ANSI codes', () => {
    setGlobalLogColor(true);
    const log = getLogger('test');
    log.info('colorful');
    const output = spyInfo.mock.calls[0][0] as string;
    expect(output).toContain('\x1b[32m'); // green for info
    expect(output).toContain('\x1b[0m'); // reset
  });

  it('no ANSI codes when color disabled', () => {
    setGlobalLogColor(false);
    const log = getLogger('test');
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
    const log = getLogger('test');
    log.info('after reset');
    // Since logs were re-enabled and level reset to 'info', this should log
    expect(spyInfo).toHaveBeenCalledOnce();
  });

  it('JSON format in bind context', () => {
    setGlobalLogFormat('json');
    const log = getLogger('test').bind({ reqId: 'r1' });
    log.debug('check');
    const output = spyDebug.mock.calls[0][0] as string;
    const parsed = JSON.parse(output);
    expect(parsed.reqId).toBe('r1');
    expect(parsed.message).toBe('check');
  });
});
