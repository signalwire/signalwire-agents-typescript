import { describe, it, expect } from 'vitest';
import { DataMap, createSimpleApiTool, createExpressionTool } from '../src/DataMap.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';

describe('DataMap', () => {
  it('basic builder produces valid swaig function', () => {
    const dm = new DataMap('get_weather')
      .purpose('Get weather')
      .parameter('location', 'string', 'City name', { required: true })
      .webhook('GET', 'https://api.weather.com?q=${location}')
      .output(new SwaigFunctionResult('Weather: ${response.temp}'));

    const fn = dm.toSwaigFunction();
    expect(fn['function']).toBe('get_weather');
    expect(fn['description']).toBe('Get weather');
    expect((fn['parameters'] as Record<string, unknown>)['required']).toEqual(['location']);
    const dataMap = fn['data_map'] as Record<string, unknown>;
    expect(dataMap['webhooks']).toBeDefined();
  });

  it('description is alias for purpose', () => {
    const dm = new DataMap('fn').description('desc');
    expect(dm.toSwaigFunction()['description']).toBe('desc');
  });

  it('default description when purpose not set', () => {
    const dm = new DataMap('my_fn');
    dm.webhook('GET', 'https://example.com').output(new SwaigFunctionResult('ok'));
    expect(dm.toSwaigFunction()['description']).toBe('Execute my_fn');
  });

  it('parameter with enum', () => {
    const dm = new DataMap('fn')
      .parameter('color', 'string', 'A color', { enum: ['red', 'blue'] });
    const params = dm.toSwaigFunction()['parameters'] as Record<string, unknown>;
    const props = params['properties'] as Record<string, Record<string, unknown>>;
    expect(props['color']['enum']).toEqual(['red', 'blue']);
  });

  it('expression-based tool', () => {
    const dm = new DataMap('ctrl')
      .purpose('Control playback')
      .parameter('cmd', 'string', 'Command')
      .expression('${args.cmd}', /start.*/, new SwaigFunctionResult('Starting'))
      .expression('${args.cmd}', 'stop', new SwaigFunctionResult('Stopping'));

    const fn = dm.toSwaigFunction();
    const dataMap = fn['data_map'] as Record<string, unknown>;
    const exprs = dataMap['expressions'] as Record<string, unknown>[];
    expect(exprs.length).toBe(2);
    expect(exprs[0]['pattern']).toBe('start.*');
    expect(exprs[1]['pattern']).toBe('stop');
  });

  it('expression with nomatch output', () => {
    const dm = new DataMap('fn')
      .expression(
        '${args.x}',
        'yes',
        new SwaigFunctionResult('matched'),
        new SwaigFunctionResult('no match'),
      );
    const fn = dm.toSwaigFunction();
    const exprs = (fn['data_map'] as Record<string, unknown>)['expressions'] as Record<string, unknown>[];
    expect(exprs[0]['nomatch-output']).toEqual({ response: 'no match' });
  });

  it('webhook with body and headers', () => {
    const dm = new DataMap('search')
      .purpose('Search docs')
      .webhook('POST', 'https://api.docs.com/search', {
        headers: { Authorization: 'Bearer TOKEN' },
      })
      .body({ query: '${query}', limit: 3 })
      .output(new SwaigFunctionResult('Found: ${response.title}'));

    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
    expect(webhooks[0]['method']).toBe('POST');
    expect(webhooks[0]['headers']).toEqual({ Authorization: 'Bearer TOKEN' });
    expect(webhooks[0]['body']).toEqual({ query: '${query}', limit: 3 });
  });

  it('webhook with params', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .params({ key: 'val' })
      .output(new SwaigFunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
    expect(webhooks[0]['params']).toEqual({ key: 'val' });
  });

  it('foreach', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .foreach({ input_key: 'results', output_key: 'out', append: '${this.title}\n' })
      .output(new SwaigFunctionResult('${out}'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
    expect(webhooks[0]['foreach']).toBeDefined();
  });

  it('multiple webhooks with fallback', () => {
    const dm = new DataMap('multi')
      .purpose('Search')
      .webhook('GET', 'https://primary.com')
      .output(new SwaigFunctionResult('Primary: ${response.title}'))
      .webhook('GET', 'https://fallback.com')
      .output(new SwaigFunctionResult('Fallback: ${response.title}'))
      .fallbackOutput(new SwaigFunctionResult('All APIs failed'));

    const fn = dm.toSwaigFunction();
    const dataMap = fn['data_map'] as Record<string, unknown>;
    expect((dataMap['webhooks'] as unknown[]).length).toBe(2);
    expect(dataMap['output']).toEqual({ response: 'All APIs failed' });
  });

  it('error keys on webhook', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .errorKeys(['error', 'message'])
      .output(new SwaigFunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
    expect(webhooks[0]['error_keys']).toEqual(['error', 'message']);
  });

  it('global error keys', () => {
    const dm = new DataMap('fn').globalErrorKeys(['err']);
    dm.webhook('GET', 'https://example.com').output(new SwaigFunctionResult('ok'));
    const dataMap = dm.toSwaigFunction()['data_map'] as Record<string, unknown>;
    expect(dataMap['error_keys']).toEqual(['err']);
  });

  it('throws if body/output/params/foreach called without webhook', () => {
    const dm = new DataMap('fn');
    expect(() => dm.body({})).toThrow('Must add webhook');
    expect(() => dm.output(new SwaigFunctionResult('x'))).toThrow('Must add webhook');
    expect(() => dm.params({})).toThrow('Must add webhook');
    expect(() => dm.foreach({ input_key: 'a', output_key: 'b', append: 'c' })).toThrow('Must add webhook');
  });

  it('webhookExpressions', () => {
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .webhookExpressions([{ string: '${response.status}', pattern: 'ok', output: { response: 'good' } }])
      .output(new SwaigFunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
    expect(webhooks[0]['expressions']).toBeDefined();
  });

  it('webhook with advanced options', () => {
    const dm = new DataMap('fn')
      .webhook('POST', 'https://example.com', {
        formParam: 'data',
        inputArgsAsParams: true,
        requireArgs: ['query'],
      })
      .output(new SwaigFunctionResult('ok'));
    const webhooks = (dm.toSwaigFunction()['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
    expect(webhooks[0]['form_param']).toBe('data');
    expect(webhooks[0]['input_args_as_params']).toBe(true);
    expect(webhooks[0]['require_args']).toEqual(['query']);
  });
});

describe('createSimpleApiTool', () => {
  it('creates a simple API tool', () => {
    const dm = createSimpleApiTool({
      name: 'weather',
      url: 'https://api.weather.com?q=${location}',
      responseTemplate: 'Temp: ${response.temp}',
      parameters: { location: { type: 'string', description: 'City', required: true } },
    });
    const fn = dm.toSwaigFunction();
    expect(fn['function']).toBe('weather');
    const params = fn['parameters'] as Record<string, unknown>;
    expect(params['required']).toEqual(['location']);
  });
});

describe('createExpressionTool', () => {
  it('creates expression-based tool', () => {
    const dm = createExpressionTool({
      name: 'ctrl',
      patterns: {
        '${args.cmd}': ['start', new SwaigFunctionResult('Starting')],
      },
    });
    const fn = dm.toSwaigFunction();
    const exprs = (fn['data_map'] as Record<string, unknown>)['expressions'] as Record<string, unknown>[];
    expect(exprs.length).toBe(1);
  });
});

// ── Pass 3: DataMap enhancements ──────────────────────────────────

describe('DataMap - registerWithAgent', () => {
  it('registers DataMap with an agent-like object', () => {
    const registered: Record<string, unknown>[] = [];
    const mockAgent = {
      registerSwaigFunction(fn: Record<string, unknown>) {
        registered.push(fn);
      },
    };
    const dm = new DataMap('my_tool')
      .purpose('Test tool')
      .webhook('GET', 'https://example.com')
      .output(new SwaigFunctionResult('ok'));

    dm.registerWithAgent(mockAgent);
    expect(registered.length).toBe(1);
    expect(registered[0]['function']).toBe('my_tool');
  });

  it('registerWithAgent returns this for chaining', () => {
    const mockAgent = { registerSwaigFunction() {} };
    const dm = new DataMap('fn')
      .webhook('GET', 'https://example.com')
      .output(new SwaigFunctionResult('ok'));
    expect(dm.registerWithAgent(mockAgent)).toBe(dm);
  });
});

describe('DataMap - ENV expansion', () => {
  it('expands ${ENV.*} variables in webhook URLs', () => {
    const saved = process.env['TEST_API_KEY'];
    process.env['TEST_API_KEY'] = 'secret123';
    try {
      const dm = new DataMap('fn')
        .enableEnvExpansion()
        .purpose('Test')
        .webhook('GET', 'https://api.example.com?key=${ENV.TEST_API_KEY}')
        .output(new SwaigFunctionResult('ok'));
      const fn = dm.toSwaigFunction();
      const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
      expect(webhooks[0]['url']).toBe('https://api.example.com?key=secret123');
    } finally {
      if (saved) process.env['TEST_API_KEY'] = saved;
      else delete process.env['TEST_API_KEY'];
    }
  });

  it('missing ENV vars expand to empty string', () => {
    delete process.env['NONEXISTENT_VAR_12345'];
    const dm = new DataMap('fn')
      .enableEnvExpansion()
      .webhook('GET', 'https://api.example.com?key=${ENV.NONEXISTENT_VAR_12345}')
      .output(new SwaigFunctionResult('ok'));
    const fn = dm.toSwaigFunction();
    const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
    expect(webhooks[0]['url']).toBe('https://api.example.com?key=');
  });

  it('no expansion when enableEnvExpansion not called', () => {
    process.env['TEST_NO_EXPAND'] = 'should-not-appear';
    try {
      const dm = new DataMap('fn')
        .webhook('GET', 'https://api.example.com?key=${ENV.TEST_NO_EXPAND}')
        .output(new SwaigFunctionResult('ok'));
      const fn = dm.toSwaigFunction();
      const webhooks = (fn['data_map'] as Record<string, unknown>)['webhooks'] as Record<string, unknown>[];
      expect(webhooks[0]['url']).toBe('https://api.example.com?key=${ENV.TEST_NO_EXPAND}');
    } finally {
      delete process.env['TEST_NO_EXPAND'];
    }
  });

  it('expands ENV vars in descriptions and outputs', () => {
    process.env['TEST_SERVICE_NAME'] = 'MyService';
    try {
      const dm = new DataMap('fn')
        .enableEnvExpansion()
        .purpose('Call ${ENV.TEST_SERVICE_NAME} API')
        .webhook('GET', 'https://example.com')
        .output(new SwaigFunctionResult('ok'));
      const fn = dm.toSwaigFunction();
      expect(fn['description']).toBe('Call MyService API');
    } finally {
      delete process.env['TEST_SERVICE_NAME'];
    }
  });

  it('enableEnvExpansion returns this for chaining', () => {
    const dm = new DataMap('fn');
    expect(dm.enableEnvExpansion()).toBe(dm);
  });
});
