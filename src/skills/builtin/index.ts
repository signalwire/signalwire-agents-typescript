/**
 * Built-in skills registry for SignalWire AI Agents.
 *
 * Import this module to register all built-in skills with the global SkillRegistry.
 */

export { DateTimeSkill, createSkill as createDateTimeSkill } from './datetime.js';
export { MathSkill, createSkill as createMathSkill } from './math.js';
export { JokeSkill, createSkill as createJokeSkill } from './joke.js';
export { WeatherApiSkill, createSkill as createWeatherApiSkill } from './weather_api.js';
export { PlayBackgroundFileSkill, createSkill as createPlayBackgroundFileSkill } from './play_background_file.js';
export { SwmlTransferSkill, createSkill as createSwmlTransferSkill } from './swml_transfer.js';
export { ApiNinjasTriviaSkill, createSkill as createApiNinjasTriviaSkill } from './api_ninjas_trivia.js';
export { InfoGathererSkill, createSkill as createInfoGathererSkill } from './info_gatherer.js';
export { CustomSkillsSkill, createSkill as createCustomSkillsSkill } from './custom_skills.js';
export { WebSearchSkill, createSkill as createWebSearchSkill } from './web_search.js';
export { WikipediaSearchSkill, createSkill as createWikipediaSearchSkill } from './wikipedia_search.js';
export { GoogleMapsSkill, createSkill as createGoogleMapsSkill } from './google_maps.js';
export { DataSphereSkill, createSkill as createDataSphereSkill } from './datasphere.js';
export { DataSphereServerlessSkill, createSkill as createDataSphereServerlessSkill } from './datasphere_serverless.js';
export { NativeVectorSearchSkill, createSkill as createNativeVectorSearchSkill } from './native_vector_search.js';
export { SpiderSkill, createSkill as createSpiderSkill } from './spider.js';
export { ClaudeSkill, createSkill as createClaudeSkill } from './claude_skills.js';
export { McpGatewaySkill, createSkill as createMcpGatewaySkill } from './mcp_gateway.js';

import { SkillRegistry } from '../SkillRegistry.js';
import { createSkill as createDateTimeSkill } from './datetime.js';
import { createSkill as createMathSkill } from './math.js';
import { createSkill as createJokeSkill } from './joke.js';
import { createSkill as createWeatherApiSkill } from './weather_api.js';
import { createSkill as createPlayBackgroundFileSkill } from './play_background_file.js';
import { createSkill as createSwmlTransferSkill } from './swml_transfer.js';
import { createSkill as createApiNinjasTriviaSkill } from './api_ninjas_trivia.js';
import { createSkill as createInfoGathererSkill } from './info_gatherer.js';
import { createSkill as createCustomSkillsSkill } from './custom_skills.js';
import { createSkill as createWebSearchSkill } from './web_search.js';
import { createSkill as createWikipediaSearchSkill } from './wikipedia_search.js';
import { createSkill as createGoogleMapsSkill } from './google_maps.js';
import { createSkill as createDataSphereSkill } from './datasphere.js';
import { createSkill as createDataSphereServerlessSkill } from './datasphere_serverless.js';
import { createSkill as createNativeVectorSearchSkill } from './native_vector_search.js';
import { createSkill as createSpiderSkill } from './spider.js';
import { createSkill as createClaudeSkill } from './claude_skills.js';
import { createSkill as createMcpGatewaySkill } from './mcp_gateway.js';

/**
 * Register all 18 built-in skills with the global SkillRegistry singleton.
 * Skips registration for any skill name already present in the registry.
 */
export function registerBuiltinSkills(): void {
  const registry = SkillRegistry.getInstance();

  const skills: [string, (config?: Record<string, unknown>) => any][] = [
    ['datetime', createDateTimeSkill],
    ['math', createMathSkill],
    ['joke', createJokeSkill],
    ['weather_api', createWeatherApiSkill],
    ['play_background_file', createPlayBackgroundFileSkill],
    ['swml_transfer', createSwmlTransferSkill],
    ['api_ninjas_trivia', createApiNinjasTriviaSkill],
    ['info_gatherer', createInfoGathererSkill],
    ['custom_skills', createCustomSkillsSkill],
    ['web_search', createWebSearchSkill],
    ['wikipedia_search', createWikipediaSearchSkill],
    ['google_maps', createGoogleMapsSkill],
    ['datasphere', createDataSphereSkill],
    ['datasphere_serverless', createDataSphereServerlessSkill],
    ['native_vector_search', createNativeVectorSearchSkill],
    ['spider', createSpiderSkill],
    ['claude_skills', createClaudeSkill],
    ['mcp_gateway', createMcpGatewaySkill],
  ];

  for (const [name, factory] of skills) {
    if (!registry.has(name)) {
      registry.register(name, factory);
    }
  }
}
