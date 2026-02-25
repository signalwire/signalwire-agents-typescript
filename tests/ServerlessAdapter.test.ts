import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ServerlessAdapter } from '../src/ServerlessAdapter.js';
import { AgentBase } from '../src/AgentBase.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';
import { suppressAllLogs } from '../src/Logger.js';

describe('ServerlessAdapter', () => {
  beforeEach(() => suppressAllLogs(true));
  afterEach(() => suppressAllLogs(false));

  it('detectPlatform returns lambda for AWS env', () => {
    const saved = process.env['AWS_LAMBDA_FUNCTION_NAME'];
    process.env['AWS_LAMBDA_FUNCTION_NAME'] = 'my-func';
    try {
      const adapter = new ServerlessAdapter('auto');
      expect(adapter.getPlatform()).toBe('lambda');
    } finally {
      if (saved) process.env['AWS_LAMBDA_FUNCTION_NAME'] = saved;
      else delete process.env['AWS_LAMBDA_FUNCTION_NAME'];
    }
  });

  it('detectPlatform returns gcf for Google env', () => {
    const saved = process.env['FUNCTION_TARGET'];
    process.env['FUNCTION_TARGET'] = 'handler';
    try {
      const adapter = new ServerlessAdapter('auto');
      expect(adapter.getPlatform()).toBe('gcf');
    } finally {
      if (saved) process.env['FUNCTION_TARGET'] = saved;
      else delete process.env['FUNCTION_TARGET'];
    }
  });

  it('explicit platform overrides detection', () => {
    const adapter = new ServerlessAdapter('azure');
    expect(adapter.getPlatform()).toBe('azure');
  });

  it('handleRequest routes through Hono app', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const adapter = new ServerlessAdapter('lambda');

    const response = await adapter.handleRequest(app, {
      httpMethod: 'GET',
      path: '/health',
      headers: { host: 'localhost' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.status).toBe('ok');
  });

  it('handleRequest passes POST body', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    agent.defineTool({
      name: 'echo',
      description: 'Echo back',
      parameters: { msg: { type: 'string' } },
      handler: (args) => new SwaigFunctionResult(`Echo: ${args['msg']}`),
    });
    const app = agent.getApp();
    const adapter = new ServerlessAdapter('lambda');

    const response = await adapter.handleRequest(app, {
      httpMethod: 'POST',
      path: '/swaig',
      headers: {
        host: 'localhost',
        'content-type': 'application/json',
        authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
      },
      body: JSON.stringify({ function: 'echo', argument: { msg: 'hi' } }),
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body);
    expect(body.response).toContain('Echo: hi');
  });

  it('handleRequest handles query parameters', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const adapter = new ServerlessAdapter('lambda');

    const response = await adapter.handleRequest(app, {
      httpMethod: 'GET',
      path: '/health',
      headers: { host: 'localhost' },
      queryStringParameters: { foo: 'bar' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('generateUrl produces Lambda URL', () => {
    const adapter = new ServerlessAdapter('lambda');
    const url = adapter.generateUrl({ region: 'us-west-2', apiId: 'abc123', stage: 'dev' });
    expect(url).toContain('us-west-2');
    expect(url).toContain('abc123');
    expect(url).toContain('dev');
  });

  it('generateUrl produces GCF URL', () => {
    const adapter = new ServerlessAdapter('gcf');
    const url = adapter.generateUrl({ projectId: 'my-proj', region: 'us-central1', functionName: 'agent' });
    expect(url).toContain('my-proj');
    expect(url).toContain('us-central1');
    expect(url).toContain('agent');
  });

  it('generateUrl produces Azure URL', () => {
    const adapter = new ServerlessAdapter('azure');
    const url = adapter.generateUrl({ functionName: 'my-agent' });
    expect(url).toContain('my-agent');
    expect(url).toContain('azurewebsites.net');
  });

  it('generateUrl produces CGI URL', () => {
    const adapter = new ServerlessAdapter('cgi');
    const url = adapter.generateUrl({ functionName: 'agent' });
    expect(url).toContain('cgi-bin');
  });

  it('createLambdaHandler returns a function', () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    const handler = ServerlessAdapter.createLambdaHandler(agent.getApp());
    expect(typeof handler).toBe('function');
  });

  it('Lambda handler processes requests', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const handler = ServerlessAdapter.createLambdaHandler(agent.getApp());

    const response = await handler({
      httpMethod: 'GET',
      path: '/health',
      headers: { host: 'localhost' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('handleRequest uses rawPath if available', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const adapter = new ServerlessAdapter('lambda');

    const response = await adapter.handleRequest(app, {
      httpMethod: 'GET',
      rawPath: '/health',
      headers: { host: 'localhost' },
    });

    expect(response.statusCode).toBe(200);
  });

  it('handleRequest defaults to POST method', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const adapter = new ServerlessAdapter('lambda');

    // No httpMethod specified
    const response = await adapter.handleRequest(app, {
      path: '/',
      headers: {
        host: 'localhost',
        authorization: 'Basic ' + Buffer.from('u:p').toString('base64'),
        'content-type': 'application/json',
      },
      body: '{}',
    });

    expect(response.statusCode).toBe(200);
  });

  it('response includes headers', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const adapter = new ServerlessAdapter('lambda');

    const response = await adapter.handleRequest(app, {
      httpMethod: 'GET',
      path: '/health',
      headers: { host: 'localhost' },
    });

    expect(response.headers).toBeDefined();
    expect(response.headers['content-type']).toContain('application/json');
  });
});
