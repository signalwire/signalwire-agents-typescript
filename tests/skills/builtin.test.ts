/**
 * Comprehensive tests for all 18 built-in skills.
 *
 * Covers instantiation, manifest, tools, prompt sections, and handler execution
 * for each skill. API-dependent skills verify error messages when keys are missing.
 */

import { describe, it, expect, beforeAll } from 'vitest';
import {
  DateTimeSkill,
  createDateTimeSkill,
  MathSkill,
  createMathSkill,
  JokeSkill,
  createJokeSkill,
  WeatherApiSkill,
  createWeatherApiSkill,
  PlayBackgroundFileSkill,
  createPlayBackgroundFileSkill,
  SwmlTransferSkill,
  createSwmlTransferSkill,
  ApiNinjasTriviaSkill,
  createApiNinjasTriviaSkill,
  InfoGathererSkill,
  createInfoGathererSkill,
  CustomSkillsSkill,
  createCustomSkillsSkill,
  WebSearchSkill,
  createWebSearchSkill,
  WikipediaSearchSkill,
  createWikipediaSearchSkill,
  GoogleMapsSkill,
  createGoogleMapsSkill,
  DataSphereSkill,
  createDataSphereSkill,
  DataSphereServerlessSkill,
  createDataSphereServerlessSkill,
  NativeVectorSearchSkill,
  createNativeVectorSearchSkill,
  SpiderSkill,
  createSpiderSkill,
  ClaudeSkill,
  createClaudeSkill,
  McpGatewaySkill,
  createMcpGatewaySkill,
} from '../../src/skills/builtin/index.js';
import { SkillBase } from '../../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../../src/SwaigFunctionResult.js';
import { suppressAllLogs } from '../../src/Logger.js';

beforeAll(() => {
  suppressAllLogs(true);
});

// ---------------------------------------------------------------------------
// DateTime Skill
// ---------------------------------------------------------------------------
describe('DateTimeSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createDateTimeSkill();
    expect(skill).toBeInstanceOf(DateTimeSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createDateTimeSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('datetime');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.description).toBeTruthy();
  });

  it('should return a get_datetime tool', () => {
    const skill = createDateTimeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_datetime');
    expect(tools[0].handler).toBeTypeOf('function');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createDateTimeSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Date and Time');
    expect(sections[0].bullets).toBeDefined();
    expect(sections[0].bullets!.length).toBeGreaterThan(0);
  });

  it('should execute handler and return datetime for a timezone', () => {
    const skill = createDateTimeSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ timezone: 'America/New_York' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('America/New_York');
    expect(result.response).toContain('current date and time');
  });
});

// ---------------------------------------------------------------------------
// Math Skill
// ---------------------------------------------------------------------------
describe('MathSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createMathSkill();
    expect(skill).toBeInstanceOf(MathSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createMathSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('math');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a calculate tool', () => {
    const skill = createMathSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('calculate');
    expect(tools[0].required).toContain('expression');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createMathSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Mathematical Calculations');
    expect(sections[0].bullets).toBeDefined();
    expect(sections[0].bullets!.length).toBeGreaterThan(0);
  });

  it('should evaluate basic math expressions correctly', () => {
    const skill = createMathSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ expression: '2 + 3 * 4' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('14');
  });

  it('should reject unsafe expressions', () => {
    const skill = createMathSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ expression: 'process.exit(1)' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('invalid characters');
  });
});

// ---------------------------------------------------------------------------
// Joke Skill
// ---------------------------------------------------------------------------
describe('JokeSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createJokeSkill();
    expect(skill).toBeInstanceOf(JokeSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createJokeSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('joke');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a tell_joke tool', () => {
    const skill = createJokeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('tell_joke');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createJokeSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Jokes');
    expect(sections[0].bullets).toBeDefined();
  });

  it('should execute handler and return a joke', () => {
    const skill = createJokeSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({}, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    // Jokes contain " ... " between setup and punchline
    expect(result.response).toContain('...');
  });
});

// ---------------------------------------------------------------------------
// Weather API Skill
// ---------------------------------------------------------------------------
describe('WeatherApiSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createWeatherApiSkill();
    expect(skill).toBeInstanceOf(WeatherApiSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createWeatherApiSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('weather_api');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('WEATHER_API_KEY');
  });

  it('should return a get_weather tool', () => {
    const skill = createWeatherApiSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_weather');
    expect(tools[0].required).toContain('location');
  });

  it('should report missing env var via validateEnvVars', () => {
    const originalKey = process.env['WEATHER_API_KEY'];
    delete process.env['WEATHER_API_KEY'];
    const skill = createWeatherApiSkill();
    const missing = skill.validateEnvVars();
    expect(missing).toContain('WEATHER_API_KEY');
    if (originalKey !== undefined) process.env['WEATHER_API_KEY'] = originalKey;
  });

  it('should return error when API key is not set', async () => {
    const originalKey = process.env['WEATHER_API_KEY'];
    delete process.env['WEATHER_API_KEY'];
    const skill = createWeatherApiSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ location: 'London' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('not configured');
    if (originalKey !== undefined) process.env['WEATHER_API_KEY'] = originalKey;
  });
});

// ---------------------------------------------------------------------------
// Play Background File Skill
// ---------------------------------------------------------------------------
describe('PlayBackgroundFileSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createPlayBackgroundFileSkill();
    expect(skill).toBeInstanceOf(PlayBackgroundFileSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createPlayBackgroundFileSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('play_background_file');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return play_background and stop_background tools', () => {
    const skill = createPlayBackgroundFileSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('play_background');
    expect(names).toContain('stop_background');
  });

  it('should execute play_background handler with a valid URL', () => {
    const skill = createPlayBackgroundFileSkill();
    const playTool = skill.getTools().find((t) => t.name === 'play_background')!;
    const result = playTool.handler(
      { file_url: 'https://example.com/music.mp3' },
      {},
    ) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('playing background audio');
    // Should have a playback_bg action
    expect(result.action.length).toBeGreaterThan(0);
    expect(result.action[0]).toHaveProperty('playback_bg');
  });

  it('should execute stop_background handler', () => {
    const skill = createPlayBackgroundFileSkill();
    const stopTool = skill.getTools().find((t) => t.name === 'stop_background')!;
    const result = stopTool.handler({}, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('stopped');
    expect(result.action.length).toBeGreaterThan(0);
    expect(result.action[0]).toHaveProperty('stop_playback_bg');
  });
});

// ---------------------------------------------------------------------------
// SWML Transfer Skill
// ---------------------------------------------------------------------------
describe('SwmlTransferSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createSwmlTransferSkill();
    expect(skill).toBeInstanceOf(SwmlTransferSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createSwmlTransferSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('swml_transfer');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a transfer_call tool', () => {
    const skill = createSwmlTransferSkill();
    const tools = skill.getTools();
    expect(tools.length).toBeGreaterThanOrEqual(1);
    expect(tools[0].name).toBe('transfer_call');
    expect(tools[0].required).toContain('destination');
  });

  it('should execute transfer with arbitrary destination', () => {
    const skill = createSwmlTransferSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ destination: '+15551234567' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toBe('Transferring your call now.');
    // Should have a SWML transfer action
    expect(result.action.length).toBeGreaterThan(0);
    const swmlAction = result.action[0];
    expect(swmlAction).toHaveProperty('SWML');
    expect(swmlAction).toHaveProperty('transfer', 'true');
  });

  it('should support named transfer patterns', () => {
    const skill = createSwmlTransferSkill({
      patterns: [
        { name: 'sales', destination: 'sip:sales@example.com', description: 'Sales team' },
        { name: 'support', destination: 'sip:support@example.com', description: 'Support team' },
      ],
    });
    const tools = skill.getTools();
    // Should have transfer_call + list_transfer_destinations
    expect(tools.length).toBe(2);
    expect(tools[1].name).toBe('list_transfer_destinations');

    // Transfer by name
    const handler = tools[0].handler;
    const result = handler({ destination: 'sales' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.action.length).toBeGreaterThan(0);
  });

  it('should reject unknown named destinations when patterns configured and arbitrary disallowed', () => {
    const skill = createSwmlTransferSkill({
      patterns: [
        { name: 'sales', destination: 'sip:sales@example.com' },
      ],
      allow_arbitrary: false,
    });
    const handler = skill.getTools()[0].handler;
    const result = handler({ destination: 'unknown_dept' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('Unknown transfer destination');
    expect(result.response).toContain('sales');
  });
});

// ---------------------------------------------------------------------------
// API Ninjas Trivia Skill
// ---------------------------------------------------------------------------
describe('ApiNinjasTriviaSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createApiNinjasTriviaSkill();
    expect(skill).toBeInstanceOf(ApiNinjasTriviaSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createApiNinjasTriviaSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('api_ninjas_trivia');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('API_NINJAS_KEY');
  });

  it('should return a get_trivia tool', () => {
    const skill = createApiNinjasTriviaSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('get_trivia');
  });

  it('should return hints for speech recognition', () => {
    const skill = createApiNinjasTriviaSkill();
    const hints = skill.getHints();
    expect(hints.length).toBeGreaterThan(0);
    expect(hints).toContain('trivia');
  });

  it('should return error when API key is not set', async () => {
    const originalKey = process.env['API_NINJAS_KEY'];
    delete process.env['API_NINJAS_KEY'];
    const skill = createApiNinjasTriviaSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({}, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('API_NINJAS_KEY');
    expect(result.response).toContain('not configured');
    if (originalKey !== undefined) process.env['API_NINJAS_KEY'] = originalKey;
  });
});

// ---------------------------------------------------------------------------
// Info Gatherer Skill
// ---------------------------------------------------------------------------
describe('InfoGathererSkill', () => {
  it('should instantiate with fields config via createSkill factory', () => {
    const skill = createInfoGathererSkill({
      fields: [
        { name: 'full_name', description: 'Full name', required: true },
        { name: 'email', description: 'Email address' },
      ],
    });
    expect(skill).toBeInstanceOf(InfoGathererSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createInfoGathererSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('info_gatherer');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return save_info and get_gathered_info tools when fields configured', () => {
    const skill = createInfoGathererSkill({
      fields: [
        { name: 'full_name', description: 'Full name', required: true },
      ],
    });
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('save_info');
    expect(names).toContain('get_gathered_info');
  });

  it('should return no tools when no fields configured', () => {
    const skill = createInfoGathererSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(0);
  });

  it('should execute save_info handler and save data', () => {
    const skill = createInfoGathererSkill({
      fields: [
        { name: 'full_name', description: 'Full name', required: true },
        { name: 'email', description: 'Email address' },
      ],
    });
    const saveTool = skill.getTools().find((t) => t.name === 'save_info')!;
    const result = saveTool.handler(
      { full_name: 'Jane Doe', email: 'jane@example.com' },
      { call_id: 'test-call-123' },
    ) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('saved successfully');
    expect(result.response).toContain('Jane Doe');
    expect(result.response).toContain('jane@example.com');
  });
});

// ---------------------------------------------------------------------------
// Custom Skills Skill
// ---------------------------------------------------------------------------
describe('CustomSkillsSkill', () => {
  it('should instantiate with tools config via createSkill factory', () => {
    const skill = createCustomSkillsSkill({
      tools: [
        {
          name: 'greet',
          description: 'Greet a user',
          handler_code: 'return new SwaigFunctionResult("Hello, " + args.name + "!");',
          parameters: [{ name: 'name', type: 'string', description: 'Name to greet' }],
        },
      ],
    });
    expect(skill).toBeInstanceOf(CustomSkillsSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createCustomSkillsSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('custom_skills');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should register dynamic tools from config', () => {
    const skill = createCustomSkillsSkill({
      tools: [
        {
          name: 'greet',
          description: 'Greet a user',
          handler_code: 'return new SwaigFunctionResult("Hello!");',
        },
        {
          name: 'farewell',
          description: 'Say goodbye',
          handler_code: 'return new SwaigFunctionResult("Goodbye!");',
        },
      ],
    });
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    expect(tools[0].name).toBe('greet');
    expect(tools[1].name).toBe('farewell');
  });

  it('should execute custom tool handler', async () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = 'true';
    try {
      const skill = createCustomSkillsSkill({
        tools: [
          {
            name: 'greet',
            description: 'Greet a user',
            handler_code: 'return new SwaigFunctionResult("Hello, " + args.name + "!");',
            parameters: [{ name: 'name', type: 'string', description: 'Name to greet' }],
          },
        ],
      });
      const handler = skill.getTools()[0].handler;
      const result = await handler({ name: 'World' }, {}) as SwaigFunctionResult;
      expect(result).toBeInstanceOf(SwaigFunctionResult);
      expect(result.response).toBe('Hello, World!');
    } finally {
      if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
      else delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    }
  });
});

// ---------------------------------------------------------------------------
// Web Search Skill
// ---------------------------------------------------------------------------
describe('WebSearchSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createWebSearchSkill();
    expect(skill).toBeInstanceOf(WebSearchSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createWebSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('web_search');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_SEARCH_API_KEY');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_SEARCH_CX');
  });

  it('should return a web_search tool', () => {
    const skill = createWebSearchSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('web_search');
    expect(tools[0].required).toContain('query');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createWebSearchSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Web Search');
  });

  it('should return error when API keys are not set', async () => {
    const origKey = process.env['GOOGLE_SEARCH_API_KEY'];
    const origCx = process.env['GOOGLE_SEARCH_CX'];
    delete process.env['GOOGLE_SEARCH_API_KEY'];
    delete process.env['GOOGLE_SEARCH_CX'];
    const skill = createWebSearchSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('not configured');
    if (origKey !== undefined) process.env['GOOGLE_SEARCH_API_KEY'] = origKey;
    if (origCx !== undefined) process.env['GOOGLE_SEARCH_CX'] = origCx;
  });
});

// ---------------------------------------------------------------------------
// Wikipedia Search Skill
// ---------------------------------------------------------------------------
describe('WikipediaSearchSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createWikipediaSearchSkill();
    expect(skill).toBeInstanceOf(WikipediaSearchSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createWikipediaSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('wikipedia_search');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a search_wikipedia tool', () => {
    const skill = createWikipediaSearchSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_wikipedia');
    expect(tools[0].required).toContain('query');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createWikipediaSearchSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toBe('Wikipedia Search');
    expect(sections[0].bullets).toBeDefined();
    expect(sections[0].bullets!.length).toBeGreaterThan(0);
  });

  it('should have no requiredEnvVars (free API)', () => {
    const skill = createWikipediaSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.requiredEnvVars).toBeUndefined();
  });
});

// ---------------------------------------------------------------------------
// Google Maps Skill
// ---------------------------------------------------------------------------
describe('GoogleMapsSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createGoogleMapsSkill();
    expect(skill).toBeInstanceOf(GoogleMapsSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createGoogleMapsSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('google_maps');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('GOOGLE_MAPS_API_KEY');
  });

  it('should return get_directions and find_place tools', () => {
    const skill = createGoogleMapsSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(2);
    const names = tools.map((t) => t.name);
    expect(names).toContain('get_directions');
    expect(names).toContain('find_place');
  });

  it('should return error from get_directions when API key is not set', async () => {
    const origKey = process.env['GOOGLE_MAPS_API_KEY'];
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const skill = createGoogleMapsSkill();
    const dirTool = skill.getTools().find((t) => t.name === 'get_directions')!;
    const result = await dirTool.handler(
      { origin: 'New York', destination: 'Boston' },
      {},
    ) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('not configured');
    if (origKey !== undefined) process.env['GOOGLE_MAPS_API_KEY'] = origKey;
  });

  it('should return error from find_place when API key is not set', async () => {
    const origKey = process.env['GOOGLE_MAPS_API_KEY'];
    delete process.env['GOOGLE_MAPS_API_KEY'];
    const skill = createGoogleMapsSkill();
    const placeTool = skill.getTools().find((t) => t.name === 'find_place')!;
    const result = await placeTool.handler(
      { query: 'pizza near me' },
      {},
    ) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('not configured');
    if (origKey !== undefined) process.env['GOOGLE_MAPS_API_KEY'] = origKey;
  });
});

// ---------------------------------------------------------------------------
// DataSphere Skill
// ---------------------------------------------------------------------------
describe('DataSphereSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createDataSphereSkill();
    expect(skill).toBeInstanceOf(DataSphereSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createDataSphereSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('datasphere');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_PROJECT_ID');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_TOKEN');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_SPACE');
  });

  it('should return a search_datasphere tool', () => {
    const skill = createDataSphereSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_datasphere');
    expect(tools[0].required).toContain('query');
  });

  it('should return non-empty prompt sections', () => {
    const skill = createDataSphereSkill();
    const sections = skill.getPromptSections();
    expect(sections.length).toBeGreaterThan(0);
    expect(sections[0].title).toContain('DataSphere');
  });

  it('should return error when env vars are not set', async () => {
    const origPid = process.env['SIGNALWIRE_PROJECT_ID'];
    const origToken = process.env['SIGNALWIRE_TOKEN'];
    const origSpace = process.env['SIGNALWIRE_SPACE'];
    delete process.env['SIGNALWIRE_PROJECT_ID'];
    delete process.env['SIGNALWIRE_TOKEN'];
    delete process.env['SIGNALWIRE_SPACE'];
    const skill = createDataSphereSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ query: 'test' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('not configured');
    expect(result.response).toContain('SIGNALWIRE_PROJECT_ID');
    if (origPid !== undefined) process.env['SIGNALWIRE_PROJECT_ID'] = origPid;
    if (origToken !== undefined) process.env['SIGNALWIRE_TOKEN'] = origToken;
    if (origSpace !== undefined) process.env['SIGNALWIRE_SPACE'] = origSpace;
  });
});

// ---------------------------------------------------------------------------
// DataSphere Serverless Skill
// ---------------------------------------------------------------------------
describe('DataSphereServerlessSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createDataSphereServerlessSkill();
    expect(skill).toBeInstanceOf(DataSphereServerlessSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createDataSphereServerlessSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('datasphere_serverless');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_PROJECT_ID');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_TOKEN');
    expect(manifest.requiredEnvVars).toContain('SIGNALWIRE_SPACE');
  });

  it('should return a search_datasphere tool stub', () => {
    const skill = createDataSphereServerlessSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_datasphere');
  });

  it('should return stub handler message indicating DataMap mode', () => {
    const skill = createDataSphereServerlessSkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({}, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('serverless DataMap');
  });

  it('should expose getDataMapTools returning a data_map function', () => {
    const skill = createDataSphereServerlessSkill();
    const dataMapTools = skill.getDataMapTools();
    expect(dataMapTools).toHaveLength(1);
    expect(dataMapTools[0]).toBeDefined();
    // The DataMap function should have a 'function' key with name
    expect(dataMapTools[0]).toHaveProperty('function');
  });
});

// ---------------------------------------------------------------------------
// Native Vector Search Skill
// ---------------------------------------------------------------------------
describe('NativeVectorSearchSkill', () => {
  const testDocuments = [
    { id: 'doc1', text: 'TypeScript is a strongly typed programming language that builds on JavaScript.' },
    { id: 'doc2', text: 'Python is a versatile programming language used for web development and data science.' },
    { id: 'doc3', text: 'Rust focuses on safety and performance, ideal for systems programming.' },
    { id: 'doc4', text: 'The weather today is sunny with clear skies and warm temperatures.' },
  ];

  it('should instantiate with documents config via createSkill factory', () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    expect(skill).toBeInstanceOf(NativeVectorSearchSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createNativeVectorSearchSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('native_vector_search');
    expect(manifest.version).toBe('1.0.0');
  });

  it('should return a search_documents tool', () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('search_documents');
    expect(tools[0].required).toContain('query');
  });

  it('should execute search and find relevant documents', () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    const handler = skill.getTools()[0].handler;
    const result = handler({ query: 'TypeScript programming language' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('doc1');
    expect(result.response).toContain('TypeScript');
  });

  it('should rank relevant documents higher (scoring works)', () => {
    const skill = createNativeVectorSearchSkill({ documents: testDocuments });
    const handler = skill.getTools()[0].handler;
    const result = handler({ query: 'programming language', top_k: 4 }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    // Programming-related docs should appear; weather doc should not (no overlap)
    expect(result.response).toContain('programming');
    // The response should contain "Result 1" indicating at least one result
    expect(result.response).toContain('Result 1');
  });
});

// ---------------------------------------------------------------------------
// Spider Skill
// ---------------------------------------------------------------------------
describe('SpiderSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createSpiderSkill();
    expect(skill).toBeInstanceOf(SpiderSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createSpiderSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('spider');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('SPIDER_API_KEY');
  });

  it('should return a scrape_url tool', () => {
    const skill = createSpiderSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('scrape_url');
    expect(tools[0].required).toContain('url');
  });

  it('should return error when API key is not set', async () => {
    const origKey = process.env['SPIDER_API_KEY'];
    delete process.env['SPIDER_API_KEY'];
    const skill = createSpiderSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ url: 'https://example.com' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('not configured');
    if (origKey !== undefined) process.env['SPIDER_API_KEY'] = origKey;
  });
});

// ---------------------------------------------------------------------------
// Claude Skills Skill
// ---------------------------------------------------------------------------
describe('ClaudeSkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createClaudeSkill();
    expect(skill).toBeInstanceOf(ClaudeSkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createClaudeSkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('claude_skills');
    expect(manifest.version).toBe('1.0.0');
    expect(manifest.requiredEnvVars).toContain('ANTHROPIC_API_KEY');
  });

  it('should return an ask_claude tool', () => {
    const skill = createClaudeSkill();
    const tools = skill.getTools();
    expect(tools).toHaveLength(1);
    expect(tools[0].name).toBe('ask_claude');
    expect(tools[0].required).toContain('prompt');
  });
});

// ---------------------------------------------------------------------------
// MCP Gateway Skill
// ---------------------------------------------------------------------------
describe('McpGatewaySkill', () => {
  it('should instantiate via createSkill factory', () => {
    const skill = createMcpGatewaySkill();
    expect(skill).toBeInstanceOf(McpGatewaySkill);
    expect(skill).toBeInstanceOf(SkillBase);
  });

  it('should return correct manifest name and version', () => {
    const skill = createMcpGatewaySkill();
    const manifest = skill.getManifest();
    expect(manifest.name).toBe('mcp_gateway');
    expect(manifest.version).toBe('0.1.0');
  });

  it('should return not implemented message from handler', () => {
    const skill = createMcpGatewaySkill();
    const handler = skill.getTools()[0].handler;
    const result = handler({ server: 'test', method: 'test' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('not yet implemented');
  });
});

// ---------------------------------------------------------------------------
// Security remediation tests
// ---------------------------------------------------------------------------
describe('CustomSkillsSkill - code gate', () => {
  it('should block handler compilation when SWML_ALLOW_CUSTOM_HANDLER_CODE is not set', () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    const skill = createCustomSkillsSkill({
      tools: [{ name: 'test_tool', description: 'Test', handler_code: 'return "hello";' }],
    });
    const errors = skill.getCompilationErrors();
    expect(errors.has('test_tool')).toBe(true);
    expect(errors.get('test_tool')).toContain('disabled');
    if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
  });

  it('should allow handler compilation when SWML_ALLOW_CUSTOM_HANDLER_CODE=true', () => {
    const saved = process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
    process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = 'true';
    const skill = createCustomSkillsSkill({
      tools: [{ name: 'test_tool', description: 'Test', handler_code: 'return "hello";' }],
    });
    const errors = skill.getCompilationErrors();
    expect(errors.has('test_tool')).toBe(false);
    if (saved) process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'] = saved;
    else delete process.env['SWML_ALLOW_CUSTOM_HANDLER_CODE'];
  });
});

describe('SpiderSkill - SSRF protection', () => {
  it('should reject URLs resolving to private IPs', async () => {
    const saved = process.env['SWML_ALLOW_PRIVATE_URLS'];
    delete process.env['SWML_ALLOW_PRIVATE_URLS'];
    const skill = createSpiderSkill();
    const handler = skill.getTools()[0].handler;
    const result = await handler({ url: 'http://127.0.0.1/secret' }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('private IP');
    if (saved) process.env['SWML_ALLOW_PRIVATE_URLS'] = saved;
  });

  it('should reject overly long input', async () => {
    const skill = createSpiderSkill();
    const handler = skill.getTools()[0].handler;
    const longUrl = 'https://example.com/' + 'a'.repeat(2000);
    const result = await handler({ url: longUrl }, {}) as SwaigFunctionResult;
    expect(result).toBeInstanceOf(SwaigFunctionResult);
    expect(result.response).toContain('too long');
  });
});
