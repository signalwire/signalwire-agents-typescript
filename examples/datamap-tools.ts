/**
 * DataMap Tools Example
 *
 * Server-side tools that call external APIs without requiring
 * your own webhook endpoints. The SignalWire platform executes
 * these directly based on the data_map configuration.
 * Run: npx tsx examples/datamap-tools.ts
 */

import {
  AgentBase,
  DataMap,
  SwaigFunctionResult,
  createSimpleApiTool,
} from '../src/index.js';

export const agent = new AgentBase({
  name: 'weather-agent',
  route: '/',
  basicAuth: [
    process.env['SWML_BASIC_AUTH_USER'] ?? 'user',
    process.env['SWML_BASIC_AUTH_PASSWORD'] ?? 'pass',
  ],
});

agent.setPromptText(
  'You are a weather assistant. Help users check the weather in any city.',
);

// Method 1: Build a DataMap manually with full control
const weatherTool = new DataMap('get_weather')
  .purpose('Get current weather for a city')
  .parameter('city', 'string', 'The city name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:args.city}?format=j1')
  .output(
    new SwaigFunctionResult(
      'Weather in ${args.city}: ${response.current_condition[0].temp_F}°F, ${response.current_condition[0].weatherDesc[0].value}',
    ),
  )
  .fallbackOutput(
    new SwaigFunctionResult('Sorry, I could not fetch the weather for that city.'),
  );

agent.registerSwaigFunction(weatherTool.toSwaigFunction());

// Method 2: Use the createSimpleApiTool helper for quick API integrations
const jokeTool = createSimpleApiTool({
  name: 'get_joke',
  url: 'https://official-joke-api.appspot.com/random_joke',
  responseTemplate: 'Here is a joke: ${response.setup} ... ${response.punchline}',
});

agent.registerSwaigFunction(jokeTool.toSwaigFunction());

agent.run();
