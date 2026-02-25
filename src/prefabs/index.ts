/**
 * Prefab agents - Ready-to-use agent implementations built on AgentBase.
 */

// InfoGathererAgent
export { InfoGathererAgent, createInfoGathererAgent } from './InfoGathererAgent.js';
export type { InfoGathererConfig, InfoGathererField } from './InfoGathererAgent.js';

// SurveyAgent
export { SurveyAgent, createSurveyAgent } from './SurveyAgent.js';
export type { SurveyConfig, SurveyQuestion } from './SurveyAgent.js';

// FAQBotAgent
export { FAQBotAgent, createFAQBotAgent } from './FAQBotAgent.js';
export type { FAQBotConfig, FAQEntry } from './FAQBotAgent.js';

// ConciergeAgent
export { ConciergeAgent, createConciergeAgent } from './ConciergeAgent.js';
export type { ConciergeConfig, Department } from './ConciergeAgent.js';

// ReceptionistAgent
export { ReceptionistAgent, createReceptionistAgent } from './ReceptionistAgent.js';
export type { ReceptionistConfig, ReceptionistDepartment } from './ReceptionistAgent.js';
