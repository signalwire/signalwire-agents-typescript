/**
 * Skills framework for SignalWire AI Agents.
 *
 * Exports the base class, manager, registry, and all associated types
 * needed to create, register, and manage agent skills.
 */

export { SkillBase } from './SkillBase.js';
export type { SkillConfig, SkillToolDefinition, SkillPromptSection, SkillManifest } from './SkillBase.js';
export { SkillManager } from './SkillManager.js';
export { SkillRegistry } from './SkillRegistry.js';
export type { SkillFactory } from './SkillRegistry.js';
