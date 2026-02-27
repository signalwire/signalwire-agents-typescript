import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';
import { ContextBuilder } from '../src/ContextBuilder.js';
import { DataMap } from '../src/DataMap.js';
import { SkillBase, type SkillManifest, type SkillToolDefinition } from '../src/skills/SkillBase.js';

describe('AgentBase', () => {
  function createAgent(opts?: Partial<Parameters<typeof AgentBase.prototype.setPromptText>[0]>) {
    return new AgentBase({ name: 'test-agent', route: '/test', ...opts } as any);
  }

  it('renders basic SWML with prompt', () => {
    const agent = createAgent();
    agent.setPromptText('You are a helpful assistant');
    const swml = JSON.parse(agent.renderSwml());
    expect(swml.version).toBe('1.0.0');
    const main = swml.sections.main;
    // Should have answer + ai verbs
    expect(main.length).toBe(2);
    expect(main[0]).toHaveProperty('answer');
    expect(main[1]).toHaveProperty('ai');
    expect(main[1].ai.prompt.text).toBe('You are a helpful assistant');
  });

  it('renders SWML without auto-answer', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', autoAnswer: false });
    agent.setPromptText('hello');
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    // Should only have AI verb, no answer
    expect(main.length).toBe(1);
    expect(main[0]).toHaveProperty('ai');
  });

  it('renders SWML with recording enabled', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', recordCall: true });
    agent.setPromptText('hello');
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    // answer + record_call + ai
    expect(main.length).toBe(3);
    expect(main[1]).toHaveProperty('record_call');
    expect(main[1].record_call.format).toBe('mp4');
  });

  it('includes tools in SWAIG', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.defineTool({
      name: 'get_time',
      description: 'Get the current time',
      parameters: {},
      handler: () => new SwaigFunctionResult('The time is 12:00'),
    });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.SWAIG).toBeDefined();
    expect(ai.SWAIG.functions.length).toBe(1);
    expect(ai.SWAIG.functions[0].function).toBe('get_time');
    expect(ai.SWAIG.defaults).toBeDefined();
    expect(ai.SWAIG.defaults.web_hook_url).toContain('/swaig');
  });

  it('includes DataMap tools in SWAIG', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    const dm = new DataMap('get_weather')
      .purpose('Get weather')
      .parameter('location', 'string', 'City', { required: true })
      .webhook('GET', 'https://api.weather.com?q=${location}')
      .output(new SwaigFunctionResult('Temp: ${response.temp}'));

    agent.registerSwaigFunction(dm.toSwaigFunction());
    const swml = JSON.parse(agent.renderSwml());
    const fns = swml.sections.main[1].ai.SWAIG.functions;
    expect(fns.length).toBe(1);
    expect(fns[0].function).toBe('get_weather');
    expect(fns[0].data_map).toBeDefined();
  });

  it('sets post prompt', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.setPostPrompt('Summarize the call');
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.post_prompt.text).toBe('Summarize the call');
    expect(ai.post_prompt_url).toBeDefined();
  });

  it('adds hints, languages, pronunciation', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addHints(['Cabby', 'SignalWire']);
    agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });
    agent.addPronunciation({ replace: 'SW', with: 'SignalWire' });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.hints).toEqual(['Cabby', 'SignalWire']);
    expect(ai.languages.length).toBe(1);
    expect(ai.pronounce.length).toBe(1);
  });

  it('sets params and global data', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.setParam('temperature', 0.5);
    agent.setGlobalData({ name: 'John' });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.params.temperature).toBe(0.5);
    expect(ai.global_data.name).toBe('John');
  });

  it('setPromptLlmParams merges into prompt', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.setPromptLlmParams({ temperature: 0.3, top_p: 0.9 });
    const swml = JSON.parse(agent.renderSwml());
    const prompt = swml.sections.main[1].ai.prompt;
    expect(prompt.temperature).toBe(0.3);
    expect(prompt.top_p).toBe(0.9);
    expect(prompt.text).toBe('hello');
  });

  it('pre-answer, post-answer, post-ai verbs', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addPreAnswerVerb('play', { urls: ['ring:us'], auto_answer: false });
    agent.addPostAnswerVerb('play', { url: 'say:Welcome!' });
    agent.addPostAiVerb('hangup', {});
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    // pre-answer play + answer + post-answer play + ai + post-ai hangup
    expect(main.length).toBe(5);
    expect(main[0]).toHaveProperty('play');
    expect(main[1]).toHaveProperty('answer');
    expect(main[2]).toHaveProperty('play');
    expect(main[3]).toHaveProperty('ai');
    expect(main[4]).toHaveProperty('hangup');
  });

  it('native functions included in SWAIG', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', nativeFunctions: ['check_time'] });
    agent.setPromptText('hello');
    agent.defineTool({
      name: 'fn',
      description: 'd',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const swml = JSON.parse(agent.renderSwml());
    expect(swml.sections.main[1].ai.SWAIG.native_functions).toEqual(['check_time']);
  });

  it('function includes', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addFunctionInclude('https://example.com/fns', ['fn1']);
    agent.defineTool({
      name: 'fn',
      description: 'd',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const swml = JSON.parse(agent.renderSwml());
    expect(swml.sections.main[1].ai.SWAIG.includes).toHaveLength(1);
  });

  it('contexts system', () => {
    const agent = createAgent();
    agent.setPromptText('You are a quiz master');
    const ctx = agent.defineContexts();
    const def = ctx.addContext('default');
    def.addStep('greeting', { task: 'Greet the user' })
      .setStepCriteria('User has been greeted')
      .setValidSteps(['quiz']);
    def.addStep('quiz', { task: 'Ask a quiz question' });
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.contexts).toBeDefined();
    expect(ai.contexts.default.steps.length).toBe(2);
  });

  it('getFullUrl returns correct URL', () => {
    const agent = new AgentBase({ name: 'test', route: '/myagent', port: 5000 });
    const url = agent.getFullUrl();
    expect(url).toContain('localhost:5000/myagent');
  });

  it('getFullUrl with auth', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', basicAuth: ['user', 'pass'] });
    const url = agent.getFullUrl(true);
    expect(url).toContain('user:pass@');
  });

  it('getBasicAuthCredentials', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', basicAuth: ['u', 'p'] });
    expect(agent.getBasicAuthCredentials()).toEqual(['u', 'p']);
  });

  it('promptAddSection builds POM prompt', () => {
    const agent = createAgent();
    agent.promptAddSection('Role', { body: 'You are a helper' });
    agent.promptAddSection('Rules', { bullets: ['Be nice'] });
    const prompt = agent.getPrompt();
    expect(prompt).toContain('Role');
    expect(prompt).toContain('You are a helper');
    expect(prompt).toContain('- Be nice');
  });

  it('renders multiple calls independently', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    const swml1 = agent.renderSwml();
    const swml2 = agent.renderSwml();
    // Both should be valid JSON
    expect(JSON.parse(swml1).version).toBe('1.0.0');
    expect(JSON.parse(swml2).version).toBe('1.0.0');
  });

  // ── Auth source tracking ────────────────────────────────────────────

  it('getBasicAuthCredentials returns source=provided when given explicitly', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', basicAuth: ['u', 'p'] });
    const [user, pass, source] = agent.getBasicAuthCredentials(true);
    expect(user).toBe('u');
    expect(pass).toBe('p');
    expect(source).toBe('provided');
  });

  it('getBasicAuthCredentials returns source=generated when auto-generated', () => {
    const savedUser = process.env['SWML_BASIC_AUTH_USER'];
    const savedPass = process.env['SWML_BASIC_AUTH_PASSWORD'];
    delete process.env['SWML_BASIC_AUTH_USER'];
    delete process.env['SWML_BASIC_AUTH_PASSWORD'];
    try {
      const agent = new AgentBase({ name: 'test', route: '/test' });
      const [user, , source] = agent.getBasicAuthCredentials(true);
      expect(user).toBe('test');
      expect(source).toBe('generated');
    } finally {
      if (savedUser) process.env['SWML_BASIC_AUTH_USER'] = savedUser;
      if (savedPass) process.env['SWML_BASIC_AUTH_PASSWORD'] = savedPass;
    }
  });

  it('getBasicAuthCredentials without source returns tuple of 2', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', basicAuth: ['u', 'p'] });
    const result = agent.getBasicAuthCredentials();
    expect(result).toHaveLength(2);
    expect(result).toEqual(['u', 'p']);
  });

  // ── Security headers ───────────────────────────────────────────────

  it('includes security headers in responses', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const res = await app.request('/health');
    expect(res.headers.get('X-Content-Type-Options')).toBe('nosniff');
    expect(res.headers.get('X-Frame-Options')).toBe('DENY');
    expect(res.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    expect(res.headers.get('Referrer-Policy')).toBe('strict-origin-when-cross-origin');
  });

  // ── CORS ──────────────────────────────────────────────────────────

  it('responds to CORS preflight', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    const app = agent.getApp();
    const res = await app.request('/health', {
      method: 'OPTIONS',
      headers: {
        'Origin': 'https://example.com',
        'Access-Control-Request-Method': 'POST',
      },
    });
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
  });

  // ── Debug events ──────────────────────────────────────────────────

  it('enableDebugEvents injects debug_webhook_url in SWML', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.enableDebugEvents(2);
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.debug_webhook_url).toBeDefined();
    expect(ai.debug_webhook_url).toContain('/debug_events');
    expect(ai.debug_webhook_level).toBe(2);
  });

  it('debug events endpoint responds to POST', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.enableDebugEvents();
    const app = agent.getApp();
    const res = await app.request('/debug_events', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ event: 'test' }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });

  it('no debug_webhook_url when debug events not enabled', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    const swml = JSON.parse(agent.renderSwml());
    const ai = swml.sections.main[1].ai;
    expect(ai.debug_webhook_url).toBeUndefined();
    expect(ai.debug_webhook_level).toBeUndefined();
  });

  // ── Tool introspection ──────────────────────────────────────────────

  it('getRegisteredTools lists all tools', () => {
    const agent = createAgent();
    agent.defineTool({
      name: 'fn1',
      description: 'Function 1',
      parameters: { x: { type: 'string' } },
      handler: () => new SwaigFunctionResult('ok'),
    });
    agent.defineTool({
      name: 'fn2',
      description: 'Function 2',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const tools = agent.getRegisteredTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('fn1');
    expect(tools[1].name).toBe('fn2');
  });

  it('getTool returns a SwaigFunction', () => {
    const agent = createAgent();
    agent.defineTool({
      name: 'my_fn',
      description: 'My function',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const tool = agent.getTool('my_fn');
    expect(tool).toBeDefined();
    expect(tool!.name).toBe('my_fn');
  });

  it('getTool returns undefined for missing tool', () => {
    const agent = createAgent();
    expect(agent.getTool('nope')).toBeUndefined();
  });

  // ── Pass 1: Agent Enhancements ────────────────────────────────────

  it('getName returns the agent name', () => {
    const agent = new AgentBase({ name: 'my-agent', route: '/test' });
    expect(agent.getName()).toBe('my-agent');
  });

  it('agentId defaults to random hex', () => {
    const agent = createAgent();
    expect(agent.agentId).toBeDefined();
    expect(typeof agent.agentId).toBe('string');
    expect(agent.agentId.length).toBe(16); // 8 bytes hex
  });

  it('agentId can be provided via options', () => {
    const agent = new AgentBase({ name: 'test', route: '/test', agentId: 'custom-id-123' } as any);
    expect(agent.agentId).toBe('custom-id-123');
  });

  it('clearPreAnswerVerbs removes pre-answer verbs', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addPreAnswerVerb('play', { url: 'ring:us' });
    agent.addPreAnswerVerb('play', { url: 'ring:uk' });
    agent.clearPreAnswerVerbs();
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    // Should only have answer + ai, no pre-answer verbs
    expect(main.length).toBe(2);
    expect(main[0]).toHaveProperty('answer');
  });

  it('clearPostAnswerVerbs removes post-answer verbs', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addPostAnswerVerb('play', { url: 'say:Welcome' });
    agent.clearPostAnswerVerbs();
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    expect(main.length).toBe(2);
  });

  it('clearPostAiVerbs removes post-ai verbs', () => {
    const agent = createAgent();
    agent.setPromptText('hello');
    agent.addPostAiVerb('hangup', {});
    agent.clearPostAiVerbs();
    const swml = JSON.parse(agent.renderSwml());
    const main = swml.sections.main;
    expect(main.length).toBe(2);
  });

  it('clear*Verbs methods return this for chaining', () => {
    const agent = createAgent();
    const result = agent.clearPreAnswerVerbs().clearPostAnswerVerbs().clearPostAiVerbs();
    expect(result).toBe(agent);
  });

  it('suppressLogs option suppresses log output', async () => {
    // We test that no error is thrown; the actual suppression is tested in Logger tests
    const { suppressAllLogs: suppress } = await import('../src/Logger.js');
    suppress(false); // reset
    const agent = new AgentBase({ name: 'test', route: '/test', suppressLogs: true } as any);
    expect(agent).toBeDefined();
    suppress(false); // cleanup
  });

  // ── Security env vars ─────────────────────────────────────────────

  it('request size limit returns 413 for oversized requests', async () => {
    const saved = process.env['SWML_MAX_REQUEST_SIZE'];
    process.env['SWML_MAX_REQUEST_SIZE'] = '50'; // 50 bytes
    try {
      const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
      agent.setPromptText('hello');
      const app = agent.getApp();
      const res = await app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa('u:p'),
          'Content-Type': 'application/json',
          'Content-Length': '100000',
        },
        body: JSON.stringify({ data: 'x'.repeat(100000) }),
      });
      expect(res.status).toBe(413);
    } finally {
      if (saved) process.env['SWML_MAX_REQUEST_SIZE'] = saved;
      else delete process.env['SWML_MAX_REQUEST_SIZE'];
    }
  });

  it('SWML_ALLOWED_HOSTS blocks disallowed hosts', async () => {
    const saved = process.env['SWML_ALLOWED_HOSTS'];
    process.env['SWML_ALLOWED_HOSTS'] = 'allowed.example.com, other.test';
    try {
      const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
      agent.setPromptText('hello');
      const app = agent.getApp();

      // Disallowed host
      const res = await app.request('http://evil.example.com/', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa('u:p'),
          'Content-Type': 'application/json',
          'Host': 'evil.example.com',
        },
        body: '{}',
      });
      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toContain('host not allowed');
    } finally {
      if (saved) process.env['SWML_ALLOWED_HOSTS'] = saved;
      else delete process.env['SWML_ALLOWED_HOSTS'];
    }
  });

  it('SWML_ALLOWED_HOSTS allows matching hosts', async () => {
    const saved = process.env['SWML_ALLOWED_HOSTS'];
    process.env['SWML_ALLOWED_HOSTS'] = 'allowed.example.com, other.test';
    try {
      const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
      agent.setPromptText('hello');
      const app = agent.getApp();

      // Allowed host
      const res = await app.request('http://allowed.example.com/', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa('u:p'),
          'Content-Type': 'application/json',
          'Host': 'allowed.example.com',
        },
        body: '{}',
      });
      expect(res.status).toBe(200);
    } finally {
      if (saved) process.env['SWML_ALLOWED_HOSTS'] = saved;
      else delete process.env['SWML_ALLOWED_HOSTS'];
    }
  });

  it('SWML_RATE_LIMIT returns 429 when exceeded', async () => {
    const saved = process.env['SWML_RATE_LIMIT'];
    process.env['SWML_RATE_LIMIT'] = '2'; // 2 requests per minute
    try {
      const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
      agent.setPromptText('hello');
      const app = agent.getApp();

      const makeReq = () => app.request('/', {
        method: 'POST',
        headers: {
          'Authorization': 'Basic ' + btoa('u:p'),
          'Content-Type': 'application/json',
          'X-Forwarded-For': '1.2.3.4',
        },
        body: '{}',
      });

      // First two should succeed
      const r1 = await makeReq();
      expect(r1.status).toBe(200);
      const r2 = await makeReq();
      expect(r2.status).toBe(200);

      // Third should be rate limited
      const r3 = await makeReq();
      expect(r3.status).toBe(429);
      const body = await r3.json();
      expect(body.error).toContain('Rate limit');
    } finally {
      if (saved) process.env['SWML_RATE_LIMIT'] = saved;
      else delete process.env['SWML_RATE_LIMIT'];
    }
  });

  // ── Pass 4: Tool lifecycle + defineTools + onFunctionCall ───────

  it('defineTools is not called automatically — subclass calls it explicitly', () => {
    let defineToolsCalled = false;
    class MyAgent extends AgentBase {
      constructor(opts: Parameters<typeof AgentBase.prototype.constructor>[0]) {
        super(opts as any);
        this.defineTools();
      }
      protected override defineTools(): void {
        defineToolsCalled = true;
        this.defineTool({
          name: 'auto_tool',
          description: 'Auto-registered tool',
          parameters: {},
          handler: () => new SwaigFunctionResult('auto'),
        });
      }
    }
    const agent = new MyAgent({ name: 'test', route: '/test' });
    expect(defineToolsCalled).toBe(true);
    expect(agent.getTool('auto_tool')).toBeDefined();
  });

  it('PROMPT_SECTIONS static property applies prompt sections', () => {
    class PromptAgent extends AgentBase {
      static PROMPT_SECTIONS = [
        { title: 'Role', body: 'You are a test agent' },
        { title: 'Rules', bullets: ['Be helpful', 'Be concise'] },
      ];
    }
    const agent = new PromptAgent({ name: 'test', route: '/test' });
    const prompt = agent.getPrompt();
    expect(prompt).toContain('Role');
    expect(prompt).toContain('You are a test agent');
    expect(prompt).toContain('Be helpful');
  });

  it('onFunctionCall hook is invoked when SWAIG function called', async () => {
    const calls: string[] = [];
    class HookAgent extends AgentBase {
      onFunctionCall(name: string, _args: Record<string, unknown>, _rawData: Record<string, unknown>): void {
        calls.push(name);
      }
    }
    const agent = new HookAgent({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.defineTool({
      name: 'test_fn',
      description: 'Test',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const app = agent.getApp();
    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'test_fn', argument: {} }),
    });
    expect(res.status).toBe(200);
    expect(calls).toContain('test_fn');
  });

  it('validateBasicAuth hook default returns true', () => {
    const agent = createAgent();
    expect(agent.validateBasicAuth('any', 'pass')).toBe(true);
  });

  it('CORS origin defaults to *', async () => {
    const saved = process.env['SWML_CORS_ORIGINS'];
    delete process.env['SWML_CORS_ORIGINS'];
    try {
      const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
      const app = agent.getApp();
      const res = await app.request('/health', {
        method: 'OPTIONS',
        headers: {
          'Origin': 'https://example.com',
          'Access-Control-Request-Method': 'POST',
        },
      });
      expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*');
    } finally {
      if (saved) process.env['SWML_CORS_ORIGINS'] = saved;
    }
  });

  // ── Pass 5: Skills integration ──────────────────────────────────

  it('addSkill registers skill tools and prompt sections', async () => {
    class TestSkill extends SkillBase {
      constructor() { super('test_skill'); }
      getManifest(): SkillManifest { return { name: 'test_skill', description: 'Test', version: '1.0.0' }; }
      getTools(): SkillToolDefinition[] {
        return [{
          name: 'skill_tool',
          description: 'Skill tool',
          handler: () => new SwaigFunctionResult('skill result'),
        }];
      }
      getPromptSections() { return [{ title: 'Skill Info', body: 'From test skill' }]; }
      getHints() { return ['skill hint']; }
    }

    const agent = createAgent();
    agent.setPromptText('base prompt');
    await agent.addSkill(new TestSkill());

    expect(agent.getTool('skill_tool')).toBeDefined();
    expect(agent.hasSkill('test_skill')).toBe(true);
    expect(agent.listSkills()).toHaveLength(1);
  });

  it('removeSkill removes a skill', async () => {
    class RemoveSkill extends SkillBase {
      constructor() { super('removable'); }
      getManifest(): SkillManifest { return { name: 'removable', description: 'Test', version: '1.0.0' }; }
      getTools(): SkillToolDefinition[] { return []; }
    }

    const agent = createAgent();
    const skill = new RemoveSkill();
    await agent.addSkill(skill);
    expect(agent.hasSkill('removable')).toBe(true);
    await agent.removeSkill(skill.instanceId);
    expect(agent.hasSkill('removable')).toBe(false);
  });

  it('addSkill returns this for chaining', async () => {
    class ChainSkill extends SkillBase {
      constructor() { super('chain'); }
      getManifest(): SkillManifest { return { name: 'chain', description: 'Test', version: '1.0.0' }; }
      getTools(): SkillToolDefinition[] { return []; }
    }

    const agent = createAgent();
    const result = await agent.addSkill(new ChainSkill());
    expect(result).toBe(agent);
  });

  it('listSkills returns empty when no skills', () => {
    const agent = createAgent();
    expect(agent.listSkills()).toHaveLength(0);
  });

  it('hasSkill returns false when no skills', () => {
    const agent = createAgent();
    expect(agent.hasSkill('nope')).toBe(false);
  });

  // ── Security remediation tests ─────────────────────────────────────

  it('setParams with __proto__ key does NOT pollute Object prototype', () => {
    const agent = createAgent();
    agent.setParams({ __proto__: { polluted: true }, temperature: 0.7 });
    expect(({} as any).polluted).toBeUndefined();
    // Normal key should still work
    const swml = JSON.parse(agent.renderSwml());
    // params are in AI config
    const ai = swml.sections.main.find((v: any) => v.ai)?.ai;
    expect(ai?.params?.temperature).toBe(0.7);
  });

  it('CORS wildcard sets credentials: false', async () => {
    const saved = process.env['SWML_CORS_ORIGINS'];
    delete process.env['SWML_CORS_ORIGINS'];
    try {
      const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
      const app = agent.getApp();
      const res = await app.request('/health', {
        method: 'GET',
        headers: { 'Origin': 'https://example.com' },
      });
      // When origin is *, credentials should not be included
      const credHeader = res.headers.get('Access-Control-Allow-Credentials');
      expect(credHeader).toBeNull();
    } finally {
      if (saved) process.env['SWML_CORS_ORIGINS'] = saved;
    }
  });

  it('invalid port throws', () => {
    expect(() => new AgentBase({ name: 'test', route: '/', port: 0 })).toThrow('Invalid port');
    expect(() => new AgentBase({ name: 'test', route: '/', port: 99999 })).toThrow('Invalid port');
    expect(() => new AgentBase({ name: 'test', route: '/', port: NaN })).toThrow('Invalid port');
  });

  it('NaN content-length returns 413', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const res = await app.request('/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
        'Content-Length': 'not-a-number',
      },
      body: '{}',
    });
    expect(res.status).toBe(413);
  });

  it('SWAIG handler error returns friendly message without internal details', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.defineTool({
      name: 'crash_fn',
      description: 'Will crash',
      parameters: {},
      handler: () => { throw new Error('secret internal error details'); },
    });
    const app = agent.getApp();
    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'crash_fn', argument: {} }),
    });
    expect(res.status).toBe(200);
    const body = await res.json();
    // SwaigFunction.execute catches errors and returns a friendly message
    expect(JSON.stringify(body)).not.toContain('secret internal error details');
    expect(body.response).toContain('try again');
  });

  it('CSP and Permissions-Policy headers are present', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const res = await app.request('/health');
    expect(res.headers.get('Content-Security-Policy')).toContain("default-src 'none'");
    expect(res.headers.get('Permissions-Policy')).toContain('camera=()');
  });

  it('rejects function names longer than 128 chars', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();
    const longName = 'x'.repeat(129);
    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: longName, argument: {} }),
    });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe('Invalid function name');
  });

  it('function-not-found log does not expose available_functions', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    agent.defineTool({
      name: 'real_tool',
      description: 'A tool',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
    });
    const app = agent.getApp();
    const res = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'nonexistent_fn', argument: {} }),
    });
    expect(res.status).toBe(404);
    // The response should not leak the list of available functions
    const text = await res.text();
    expect(text).not.toContain('real_tool');
  });

  it('invalid token returns 200 with SwaigFunctionResult (not 403)', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.defineTool({
      name: 'secure_fn',
      description: 'Secure function',
      parameters: {},
      handler: () => new SwaigFunctionResult('ok'),
      secure: true,
    });
    const app = agent.getApp();

    // Missing token
    const res1 = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'secure_fn', argument: {} }),
    });
    expect(res1.status).toBe(200);
    const body1 = await res1.json();
    expect(body1.response).toContain('security token');

    // Invalid token
    const res2 = await app.request('/swaig?__token=bogus_token', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'secure_fn', argument: {} }),
    });
    expect(res2.status).toBe(200);
    const body2 = await res2.json();
    expect(body2.response).toContain('security token');
  });

  it('rejects function names with invalid characters', async () => {
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.setPromptText('hello');
    const app = agent.getApp();

    // SQL injection attempt
    const res1 = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'valid_fn; DROP TABLE', argument: {} }),
    });
    expect(res1.status).toBe(400);

    // Names starting with numbers
    const res2 = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: '123invalid', argument: {} }),
    });
    expect(res2.status).toBe(400);

    // Valid names should pass the format check (still 404 since not registered)
    const res3 = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'valid_fn_name', argument: {} }),
    });
    expect(res3.status).toBe(404); // not registered, but passed format validation
  });

  it('non-object argument is coerced to empty object', async () => {
    const captured: Record<string, unknown>[] = [];
    const agent = new AgentBase({ name: 'test', route: '/', basicAuth: ['u', 'p'] });
    agent.defineTool({
      name: 'arg_test',
      description: 'Test args',
      parameters: {},
      handler: (_args, _params, _body) => {
        captured.push(_args);
        return new SwaigFunctionResult('ok');
      },
    });
    const app = agent.getApp();

    // String argument
    const res1 = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'arg_test', argument: 'not-an-object' }),
    });
    expect(res1.status).toBe(200);

    // Array argument
    const res2 = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'arg_test', argument: [1, 2, 3] }),
    });
    expect(res2.status).toBe(200);

    // Null argument
    const res3 = await app.request('/swaig', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('u:p'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ function: 'arg_test', argument: null }),
    });
    expect(res3.status).toBe(200);

    // All non-object arguments should be coerced to {}
    expect(captured.length).toBe(3);
    for (const args of captured) {
      expect(args).toEqual({});
    }
  });

  it('auto-generated password is 32 hex chars', () => {
    const savedUser = process.env['SWML_BASIC_AUTH_USER'];
    const savedPass = process.env['SWML_BASIC_AUTH_PASSWORD'];
    delete process.env['SWML_BASIC_AUTH_USER'];
    delete process.env['SWML_BASIC_AUTH_PASSWORD'];
    try {
      const agent = new AgentBase({ name: 'test-auto-pass', route: '/' });
      const [, pass] = agent.getBasicAuthCredentials();
      expect(pass.length).toBe(32);
      expect(/^[0-9a-f]{32}$/.test(pass)).toBe(true);
    } finally {
      if (savedUser) process.env['SWML_BASIC_AUTH_USER'] = savedUser;
      if (savedPass) process.env['SWML_BASIC_AUTH_PASSWORD'] = savedPass;
    }
  });
});
