/**
 * Tests for AgentBase.setupGracefulShutdown().
 */

import { AgentBase } from '../src/AgentBase.js';

describe('setupGracefulShutdown', () => {
  const originalOn = process.on;
  const registeredHandlers: { event: string; handler: Function }[] = [];

  beforeEach(() => {
    // Reset the static flag so tests are independent
    (AgentBase as any)._shutdownRegistered = false;
    registeredHandlers.length = 0;

    // Mock process.on to capture registered handlers
    process.on = vi.fn((event: string, handler: any) => {
      registeredHandlers.push({ event, handler });
      return process;
    }) as any;
  });

  afterEach(() => {
    process.on = originalOn;
  });

  it('registers SIGTERM and SIGINT handlers', () => {
    AgentBase.setupGracefulShutdown();
    const events = registeredHandlers.map((h) => h.event);
    expect(events).toContain('SIGTERM');
    expect(events).toContain('SIGINT');
  });

  it('does not register duplicate handlers on second call', () => {
    AgentBase.setupGracefulShutdown();
    const count1 = registeredHandlers.length;
    AgentBase.setupGracefulShutdown();
    expect(registeredHandlers.length).toBe(count1);
  });

  it('accepts custom timeout', () => {
    // Just verifies it doesn't throw
    AgentBase.setupGracefulShutdown({ timeout: 10000 });
    expect(registeredHandlers.length).toBe(2);
  });
});
