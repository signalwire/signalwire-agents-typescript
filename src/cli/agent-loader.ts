/**
 * Agent discovery via dynamic import for swaig-test CLI.
 *
 * Tries multiple strategies to find an AgentBase instance:
 * 1. Named export `agent`
 * 2. Default export
 * 3. Any exported AgentBase instance (duck-typed)
 * 4. Any exported AgentBase subclass (instantiated)
 */

import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

function isAgentInstance(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a['renderSwml'] === 'function' &&
    typeof a['defineTool'] === 'function' &&
    typeof a['getPrompt'] === 'function'
  );
}

function isAgentClass(obj: unknown): boolean {
  if (typeof obj !== 'function') return false;
  const proto = (obj as any).prototype;
  if (!proto) return false;
  return (
    typeof proto['renderSwml'] === 'function' &&
    typeof proto['defineTool'] === 'function' &&
    typeof proto['getPrompt'] === 'function'
  );
}

async function importModule(agentPath: string): Promise<Record<string, unknown>> {
  const absPath = resolve(agentPath);
  const fileUrl = pathToFileURL(absPath).href;

  try {
    return await import(fileUrl);
  } catch (err) {
    throw new Error(`Failed to import agent file: ${absPath}\n${err}`);
  }
}

/**
 * Dynamically import an agent file and resolve an AgentBase instance using duck-typing heuristics.
 * @param agentPath - Path to the agent module file.
 * @param agentClass - Optional name of a specific exported class or instance to use.
 * @returns The resolved AgentBase instance.
 */
export async function loadAgent(agentPath: string, agentClass?: string): Promise<unknown> {
  const mod = await importModule(agentPath);

  // If a specific class name is requested
  if (agentClass) {
    const target = mod[agentClass];
    if (!target) {
      throw new Error(`Export '${agentClass}' not found in ${agentPath}`);
    }
    if (isAgentInstance(target)) return target;
    if (isAgentClass(target)) {
      const Cls = target as new (opts: { name: string }) => unknown;
      return new Cls({ name: agentClass.toLowerCase() });
    }
    throw new Error(`Export '${agentClass}' is not an AgentBase instance or class`);
  }

  // 1. Named export `agent`
  if (mod['agent'] && isAgentInstance(mod['agent'])) {
    return mod['agent'];
  }

  // 2. Default export (instance)
  if (mod['default'] && isAgentInstance(mod['default'])) {
    return mod['default'];
  }

  // 3. Any exported AgentBase instance
  for (const key of Object.keys(mod)) {
    if (isAgentInstance(mod[key])) {
      return mod[key];
    }
  }

  // 4. Default export (class) - instantiate
  if (mod['default'] && isAgentClass(mod['default'])) {
    const Cls = mod['default'] as new (opts: { name: string }) => unknown;
    return new Cls({ name: 'cli-agent' });
  }

  // 5. Any exported AgentBase subclass
  for (const key of Object.keys(mod)) {
    if (isAgentClass(mod[key])) {
      const Cls = mod[key] as new (opts: { name: string }) => unknown;
      return new Cls({ name: 'cli-agent' });
    }
  }

  throw new Error(
    `Could not find an AgentBase instance or subclass in ${resolve(agentPath)}.\n` +
    'Export your agent as `export const agent = new AgentBase(...)` or as default export.',
  );
}

/**
 * List all exported agent instances and classes in a module.
 * @param agentPath - Path to the agent module file.
 * @returns Array of export names that are AgentBase instances or subclasses.
 */
export async function listAgents(agentPath: string): Promise<string[]> {
  const mod = await importModule(agentPath);
  const agents: string[] = [];

  for (const key of Object.keys(mod)) {
    if (isAgentInstance(mod[key]) || isAgentClass(mod[key])) {
      agents.push(key);
    }
  }

  return agents;
}
