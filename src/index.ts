/**
 * SignalWire AI Agents SDK for TypeScript
 *
 * Build AI voice agents as HTTP microservices that serve SWML documents
 * and handle SWAIG function callbacks.
 */

// Core agent
export { AgentBase } from './AgentBase.js';
export { AgentServer } from './AgentServer.js';

// SWML Service (non-AI call flows)
export { SWMLService } from './SWMLService.js';
export type { OnRequestCallback, SWMLServiceOptions } from './SWMLService.js';

// Tool results & functions
export { SwaigFunctionResult } from './SwaigFunctionResult.js';
export type { PaymentPrompt, PaymentAction, PaymentParameter } from './SwaigFunctionResult.js';
export { SwaigFunction } from './SwaigFunction.js';
export type { SwaigHandler, SwaigFunctionOptions } from './SwaigFunction.js';

// DataMap (server-side tools)
export { DataMap, createSimpleApiTool, createExpressionTool } from './DataMap.js';

// Prompt Object Model
export { PomBuilder, PomSection } from './PomBuilder.js';
export type { PomSectionData } from './PomBuilder.js';

// SWML builder
export { SwmlBuilder } from './SwmlBuilder.js';
import './SwmlVerbMethods.generated.js';

// Prompt management
export { PromptManager } from './PromptManager.js';

// Contexts & Steps
export {
  ContextBuilder,
  Context,
  Step,
  GatherInfo,
  GatherQuestion,
  createSimpleContext,
} from './ContextBuilder.js';

// Security
export { SessionManager } from './SessionManager.js';

// SSL
export { SslConfig } from './SslConfig.js';
export type { SslOptions } from './SslConfig.js';

// Schema Validation
export { SchemaUtils } from './SchemaUtils.js';
export type { ValidationResult } from './SchemaUtils.js';

// Auth
export { AuthHandler } from './AuthHandler.js';
export type { AuthConfig } from './AuthHandler.js';

// Config
export { ConfigLoader } from './ConfigLoader.js';

// Logging
export { Logger, getLogger, setGlobalLogLevel, suppressAllLogs, setGlobalLogFormat, setGlobalLogColor, setGlobalLogStream, resetLoggingConfiguration, getExecutionMode } from './Logger.js';

// Serverless
export { ServerlessAdapter } from './ServerlessAdapter.js';
export type { ServerlessPlatform, ServerlessEvent, ServerlessResponse } from './ServerlessAdapter.js';

// Skills
export { SkillBase, SkillManager, SkillRegistry } from './skills/index.js';
export type { SkillConfig, SkillToolDefinition, SkillPromptSection, SkillManifest, SkillFactory, ParameterSchemaEntry, SkillSchemaInfo } from './skills/index.js';

// Built-in Skills
export { registerBuiltinSkills } from './skills/builtin/index.js';
export {
  DateTimeSkill, MathSkill, JokeSkill,
  WeatherApiSkill, PlayBackgroundFileSkill, SwmlTransferSkill,
  ApiNinjasTriviaSkill, InfoGathererSkill, CustomSkillsSkill,
  WebSearchSkill, WikipediaSearchSkill, GoogleMapsSkill,
  DataSphereSkill, DataSphereServerlessSkill, NativeVectorSearchSkill,
  SpiderSkill, ClaudeSkill, McpGatewaySkill,
} from './skills/builtin/index.js';

// Prefab Agents
export {
  InfoGathererAgent, SurveyAgent, FAQBotAgent,
  ConciergeAgent, ReceptionistAgent,
} from './prefabs/index.js';
export type {
  InfoGathererConfig, SurveyConfig, FAQBotConfig,
  ConciergeConfig, ReceptionistConfig,
} from './prefabs/index.js';

// Types
export type {
  AgentOptions,
  LanguageConfig,
  PronunciationRule,
  FunctionInclude,
  DynamicConfigCallback,
  SummaryCallback,
} from './types.js';
