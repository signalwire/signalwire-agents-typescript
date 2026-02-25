/**
 * Agent discovery via dynamic import for swaig-test CLI.
 *
 * Tries multiple strategies to find an AgentBase instance:
 * 1. Named export `agent`
 * 2. Default export
 * 3. Any exported AgentBase instance (duck-typed)
 * 4. Any exported AgentBase subclass (instantiated)
 */

import { resolve, extname } from 'node:path';
import { pathToFileURL } from 'node:url';

/** Allowed file extensions for agent loading. */
const ALLOWED_EXTENSIONS = new Set(['.ts', '.js', '.mjs', '.mts']);

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

function isSWMLServiceInstance(obj: unknown): boolean {
  if (!obj || typeof obj !== 'object') return false;
  const a = obj as Record<string, unknown>;
  return (
    typeof a['renderSwml'] === 'function' &&
    typeof a['getApp'] === 'function' &&
    typeof a['addVerb'] === 'function' &&
    typeof a['defineTool'] !== 'function'
  );
}

/**
 * Import a module by path after validating the file extension.
 *
 * **Security note:** Only `.ts`, `.js`, `.mjs`, and `.mts` extensions are allowed
 * to prevent loading unexpected file types via dynamic import.
 */
async function importModule(agentPath: string): Promise<Record<string, unknown>> {
  const absPath = resolve(agentPath);
  const ext = extname(absPath).toLowerCase();
  if (!ALLOWED_EXTENSIONS.has(ext)) {
    throw new Error(
      `Unsupported file extension '${ext}' for agent file: ${absPath}. ` +
      `Only ${[...ALLOWED_EXTENSIONS].join(', ')} files are allowed.`,
    );
  }
  const fileUrl = pathToFileURL(absPath).href;

  // Suppress server startup: agent files call .run() at module scope,
  // but the CLI only needs the configured agent instance, not a running server.
  process.env['SWAIG_CLI_MODE'] = 'true';
  try {
    return await import(fileUrl);
  } catch (err) {
    throw new Error(`Failed to import agent file: ${absPath}\n${err}`);
  } finally {
    delete process.env['SWAIG_CLI_MODE'];
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

  // 6. Named export `agent` as SWMLService
  if (mod['agent'] && isSWMLServiceInstance(mod['agent'])) {
    return mod['agent'];
  }

  // 7. Any exported SWMLService instance
  for (const key of Object.keys(mod)) {
    if (isSWMLServiceInstance(mod[key])) {
      return mod[key];
    }
  }

  throw new Error(
    `Could not find an AgentBase or SWMLService instance in ${resolve(agentPath)}.\n` +
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
    if (isAgentInstance(mod[key]) || isAgentClass(mod[key]) || isSWMLServiceInstance(mod[key])) {
      agents.push(key);
    }
  }

  return agents;
}
