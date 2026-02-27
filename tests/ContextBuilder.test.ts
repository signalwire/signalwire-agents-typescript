import { describe, it, expect } from 'vitest';
import { ContextBuilder, Context } from '../src/ContextBuilder.js';

describe('ContextBuilder', () => {
  it('addContext throws when exceeding MAX_CONTEXTS (50)', () => {
    const cb = new ContextBuilder();
    for (let i = 0; i < 50; i++) {
      cb.addContext(`ctx_${i}`);
    }
    expect(() => cb.addContext('one_too_many')).toThrow('Maximum number of contexts (50) exceeded');
  });

  it('addStep throws when exceeding MAX_STEPS_PER_CONTEXT (100)', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    for (let i = 0; i < 100; i++) {
      ctx.addStep(`step_${i}`, { task: `Task ${i}` });
    }
    expect(() => ctx.addStep('one_too_many', { task: 'Overflow' })).toThrow(
      'Maximum steps per context (100) exceeded'
    );
  });

  it('allows exactly 50 contexts', () => {
    const cb = new ContextBuilder();
    for (let i = 0; i < 50; i++) {
      cb.addContext(`ctx_${i}`);
    }
    expect(cb.getContext('ctx_49')).toBeDefined();
  });

  it('allows exactly 100 steps per context', () => {
    const cb = new ContextBuilder();
    const ctx = cb.addContext('default');
    for (let i = 0; i < 100; i++) {
      ctx.addStep(`step_${i}`, { task: `Task ${i}` });
    }
    expect(ctx.getStep('step_99')).toBeDefined();
  });
});
