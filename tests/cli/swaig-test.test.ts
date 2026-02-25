import { describe, it, expect } from 'vitest';
import { AgentBase } from '../../src/AgentBase.js';
import { SwaigFunctionResult } from '../../src/SwaigFunctionResult.js';

describe('agent introspection', () => {
  function createAgent() {
    const agent = new AgentBase({ name: 'test-agent', route: '/test' });
    agent.setPromptText('Hello from test agent');
    agent.defineTool({
      name: 'greet',
      description: 'Say hello',
      parameters: { name: { type: 'string', description: 'Name' } },
      handler: (args) => new SwaigFunctionResult('Hello ' + (args['name'] || 'world')),
    });
    agent.defineTool({
      name: 'get_time',
      description: 'Get current time',
      parameters: {},
      handler: () => new SwaigFunctionResult('12:00 PM'),
    });
    return agent;
  }

  it('getRegisteredTools returns all tool info', () => {
    const agent = createAgent();
    const tools = agent.getRegisteredTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('greet');
    expect(tools[0].description).toBe('Say hello');
    expect(tools[0].parameters).toHaveProperty('name');
    expect(tools[1].name).toBe('get_time');
  });

  it('getRegisteredTools returns empty for no tools', () => {
    const agent = new AgentBase({ name: 'empty', route: '/test' });
    expect(agent.getRegisteredTools()).toHaveLength(0);
  });

  it('getTool returns a specific SwaigFunction', () => {
    const agent = createAgent();
    const tool = agent.getTool('greet');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('greet');
    expect(tool!.description).toBe('Say hello');
  });

  it('getTool returns undefined for missing tool', () => {
    const agent = createAgent();
    expect(agent.getTool('nonexistent')).toBeUndefined();
  });

  it('can execute tool via getTool', async () => {
    const agent = createAgent();
    const tool = agent.getTool('greet')!;
    const result = await tool.execute({ name: 'Alice' }, {});
    expect(result.response).toBe('Hello Alice');
  });

  it('can execute tool with no args', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_time')!;
    const result = await tool.execute({}, {});
    expect(result.response).toBe('12:00 PM');
  });

  it('renderSwml produces valid SWML with tools', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call-id');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
    const ai = parsed.sections.main[1].ai;
    expect(ai.SWAIG.functions).toHaveLength(2);
  });
});

describe('agent-loader file extension validation', () => {
  it('rejects unsupported file extensions', async () => {
    const { loadAgent } = await import('../../src/cli/agent-loader.js');
    await expect(loadAgent('/tmp/agent.txt')).rejects.toThrow('Unsupported file extension');
  });

  it('rejects .json files', async () => {
    const { loadAgent } = await import('../../src/cli/agent-loader.js');
    await expect(loadAgent('/tmp/agent.json')).rejects.toThrow('Unsupported file extension');
  });
});

describe('agent-loader duck typing', () => {
  it('AgentBase instances pass duck-type check', () => {
    const agent = new AgentBase({ name: 'test', route: '/test' });
    // The duck-type check used by agent-loader
    expect(typeof (agent as any).renderSwml).toBe('function');
    expect(typeof (agent as any).defineTool).toBe('function');
    expect(typeof (agent as any).getPrompt).toBe('function');
  });

  it('plain objects do not pass duck-type check', () => {
    const obj = { renderSwml: 'not a function' };
    expect(typeof obj.renderSwml).not.toBe('function');
  });

  it('AgentBase class prototype has required methods', () => {
    expect(typeof AgentBase.prototype.renderSwml).toBe('function');
    expect(typeof AgentBase.prototype.defineTool).toBe('function');
    expect(typeof AgentBase.prototype.getPrompt).toBe('function');
  });
});
