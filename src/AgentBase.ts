/**
 * AgentBase - Core agent class with Hono HTTP server and 5-phase SWML rendering.
 *
 * Composes PromptManager, SessionManager, SwmlBuilder, and a tool registry
 * into a single HTTP-servable agent.
 */

import { Hono } from 'hono';
import { basicAuth } from 'hono/basic-auth';
import { cors } from 'hono/cors';
import { randomBytes } from 'node:crypto';
import { PromptManager } from './PromptManager.js';
import { SessionManager } from './SessionManager.js';
import { SwmlBuilder } from './SwmlBuilder.js';
import { SwaigFunction, type SwaigHandler, type SwaigFunctionOptions } from './SwaigFunction.js';
import { SwaigFunctionResult } from './SwaigFunctionResult.js';
import { ContextBuilder } from './ContextBuilder.js';
import { getLogger, suppressAllLogs } from './Logger.js';
import { safeAssign, filterSensitiveHeaders, redactUrl, isValidHostname } from './SecurityUtils.js';
import { SkillManager } from './skills/SkillManager.js';
import type { SkillBase } from './skills/SkillBase.js';
import type {
  AgentOptions,
  LanguageConfig,
  PronunciationRule,
  FunctionInclude,
  DynamicConfigCallback,
} from './types.js';

/**
 * Core agent class that composes an HTTP server, prompt management, session handling,
 * SWAIG tool registry, and 5-phase SWML rendering into a single deployable unit.
 */
export class AgentBase {
  /** Display name of this agent. */
  name: string;
  /** HTTP route path this agent listens on. */
  route: string;
  /** Hostname the HTTP server binds to. */
  host: string;
  /** Port number the HTTP server listens on. */
  port: number;
  /** Unique identifier for this agent instance. */
  agentId: string;

  // Internal managers
  private promptManager: PromptManager;
  private sessionManager: SessionManager;
  private swmlBuilder: SwmlBuilder;
  private toolRegistry: Map<string, SwaigFunction | Record<string, unknown>> = new Map();

  // Auth
  private basicAuthCreds: [string, string];
  private basicAuthSource: 'provided' | 'environment' | 'generated' = 'generated';

  // Call settings
  private autoAnswer: boolean;
  private _recordCall: boolean;
  private recordFormat: string;
  private recordStereo: boolean;
  private defaultWebhookUrl: string | null;
  private nativeFunctions: string[];

  // AI config
  private hints: string[] = [];
  private languages: LanguageConfig[] = [];
  private pronounce: PronunciationRule[] = [];
  private params: Record<string, unknown> = {};
  private globalData: Record<string, unknown> = {};
  private functionIncludes: FunctionInclude[] = [];
  private promptLlmParams: Record<string, unknown> = {};
  private postPromptLlmParams: Record<string, unknown> = {};
  private internalFillers: Record<string, Record<string, string[]>> = {};

  // Call flow verbs
  private preAnswerVerbs: [string, Record<string, unknown>][] = [];
  private answerConfig: Record<string, unknown> = {};
  private postAnswerVerbs: [string, Record<string, unknown>][] = [];
  private postAiVerbs: [string, Record<string, unknown>][] = [];

  // Dynamic config
  private dynamicConfigCallback: DynamicConfigCallback | null = null;
  private swaigQueryParams: Record<string, string> = {};

  // Webhook URL overrides
  private webHookUrlOverride: string | null = null;
  private postPromptUrlOverride: string | null = null;

  // Contexts
  private contextsBuilder: ContextBuilder | null = null;

  // Debug
  private debugEventsEnabled = false;
  private debugEventsLevel = 1;

  // Proxy detection
  private _proxyUrlBase: string | null = process.env['SWML_PROXY_URL_BASE'] ?? null;
  private _proxyUrlBaseFromEnv = !!process.env['SWML_PROXY_URL_BASE'];
  private _proxyDebug = process.env['SWML_PROXY_DEBUG'] === 'true';
  private _trustProxyHeaders = process.env['SWML_TRUST_PROXY_HEADERS'] === 'true';
  private _enforceHttps = process.env['SWML_ENFORCE_HTTPS'] === 'true';

  /** Structured logger instance for this agent, configurable via SIGNALWIRE_LOG_LEVEL. */
  protected log = getLogger('AgentBase');

  // Skills
  private skillManager = new SkillManager();

  // Hono app
  private _app: Hono | null = null;

  /**
   * Create a new AgentBase instance.
   * @param opts - Agent configuration options including name, route, auth, and call settings.
   */
  constructor(opts: AgentOptions) {
    this.name = opts.name;
    this.route = (opts.route ?? '/').replace(/\/+$/, '') || '/';
    this.host = opts.host ?? '0.0.0.0';
    const parsedPort = opts.port ?? parseInt(process.env['PORT'] ?? '3000', 10);
    if (isNaN(parsedPort) || parsedPort < 1 || parsedPort > 65535) {
      throw new Error(`Invalid port: ${opts.port ?? process.env['PORT']}. Must be between 1 and 65535.`);
    }
    this.port = parsedPort;
    this.agentId = opts.agentId ?? randomBytes(8).toString('hex');
    this.autoAnswer = opts.autoAnswer ?? true;
    this._recordCall = opts.recordCall ?? false;
    this.recordFormat = opts.recordFormat ?? 'mp4';
    this.recordStereo = opts.recordStereo ?? true;
    this.defaultWebhookUrl = opts.defaultWebhookUrl ?? null;
    this.nativeFunctions = opts.nativeFunctions ?? [];

    if (opts.suppressLogs) {
      suppressAllLogs(true);
    }

    this.promptManager = new PromptManager(opts.usePom ?? true);
    this.sessionManager = new SessionManager(opts.tokenExpirySecs ?? 900);
    this.swmlBuilder = new SwmlBuilder();

    // Setup auth
    if (opts.basicAuth) {
      this.basicAuthCreds = opts.basicAuth;
      this.basicAuthSource = 'provided';
    } else {
      const envUser = process.env['SWML_BASIC_AUTH_USER'];
      const envPass = process.env['SWML_BASIC_AUTH_PASSWORD'];
      if (envUser && envPass) {
        this.basicAuthCreds = [envUser, envPass];
        this.basicAuthSource = 'environment';
      } else {
        this.basicAuthCreds = [this.name, randomBytes(16).toString('hex')];
        this.basicAuthSource = 'generated';
      }
    }

    // Apply static PROMPT_SECTIONS from the class if defined
    const ctor = this.constructor as typeof AgentBase;
    if (ctor.PROMPT_SECTIONS) {
      for (const section of ctor.PROMPT_SECTIONS) {
        this.promptAddSection(section.title, section);
      }
    }
  }

  /**
   * Static prompt sections: subclasses can define these declaratively.
   * Each entry is applied via promptAddSection() in the constructor.
   */
  static PROMPT_SECTIONS?: { title: string; body?: string; bullets?: string[]; numbered?: boolean }[];

  /**
   * Lifecycle method to register tools. Subclasses should call this at the
   * end of their own constructor (after all fields are initialized).
   * Not called automatically — call `this.defineTools()` explicitly.
   */
  protected defineTools(): void {
    // Default no-op — subclasses override
  }

  // ── Prompt methods ──────────────────────────────────────────────────

  /**
   * Set the main system prompt text for the AI.
   * @param text - The prompt text to use.
   * @returns This agent instance for chaining.
   */
  setPromptText(text: string): this {
    this.promptManager.setPromptText(text);
    return this;
  }

  /**
   * Set the post-prompt text evaluated after the call ends.
   * @param text - The post-prompt text to use.
   * @returns This agent instance for chaining.
   */
  setPostPrompt(text: string): this {
    this.promptManager.setPostPrompt(text);
    return this;
  }

  /**
   * Add a new section to the prompt with optional body, bullets, and subsections.
   * @param title - Section heading.
   * @param opts - Optional section content including body text, bullet points, and subsections.
   * @returns This agent instance for chaining.
   */
  promptAddSection(
    title: string,
    opts?: {
      body?: string;
      bullets?: string[];
      numbered?: boolean;
      numberedBullets?: boolean;
      subsections?: { title: string; body?: string; bullets?: string[] }[];
    },
  ): this {
    this.promptManager.addSection(title, opts);
    return this;
  }

  /**
   * Append content to an existing prompt section.
   * @param title - Title of the section to append to.
   * @param opts - Content to add: body text, a single bullet, or multiple bullets.
   * @returns This agent instance for chaining.
   */
  promptAddToSection(
    title: string,
    opts?: { body?: string; bullet?: string; bullets?: string[] },
  ): this {
    this.promptManager.addToSection(title, opts);
    return this;
  }

  /**
   * Add a subsection under an existing prompt section.
   * @param parentTitle - Title of the parent section.
   * @param title - Title of the new subsection.
   * @param opts - Optional body text and bullet points for the subsection.
   * @returns This agent instance for chaining.
   */
  promptAddSubsection(parentTitle: string, title: string, opts?: { body?: string; bullets?: string[] }): this {
    this.promptManager.addSubsection(parentTitle, title, opts);
    return this;
  }

  /**
   * Check whether a prompt section with the given title exists.
   * @param title - Section title to look for.
   * @returns True if the section exists.
   */
  promptHasSection(title: string): boolean {
    return this.promptManager.hasSection(title);
  }

  /**
   * Get the fully rendered main prompt text.
   * @returns The assembled prompt string.
   */
  getPrompt(): string {
    return this.promptManager.getPrompt();
  }

  /**
   * Get the post-prompt text, if one has been set.
   * @returns The post-prompt string, or null if not configured.
   */
  getPostPrompt(): string | null {
    return this.promptManager.getPostPrompt();
  }

  // ── Contexts ────────────────────────────────────────────────────────

  /**
   * Define or replace the contexts configuration for the AI verb.
   * @param contexts - An existing ContextBuilder instance or a plain object; a new ContextBuilder is created if omitted.
   * @returns The active ContextBuilder for further configuration.
   */
  defineContexts(contexts?: ContextBuilder | Record<string, unknown>): ContextBuilder {
    if (contexts instanceof ContextBuilder) {
      this.contextsBuilder = contexts;
    } else {
      this.contextsBuilder = new ContextBuilder();
    }
    return this.contextsBuilder;
  }

  // ── AI config methods ───────────────────────────────────────────────

  /**
   * Add a single speech-recognition hint.
   * @param hint - Word or phrase to boost in speech recognition.
   * @returns This agent instance for chaining.
   */
  addHint(hint: string): this {
    this.hints.push(hint);
    return this;
  }

  /**
   * Add multiple speech-recognition hints at once.
   * @param hints - Array of words or phrases to boost.
   * @returns This agent instance for chaining.
   */
  addHints(hints: string[]): this {
    this.hints.push(...hints);
    return this;
  }

  /**
   * Add a pattern-based speech-recognition hint with find-and-replace behavior.
   * @param opts - Pattern hint configuration with regex pattern, replacement, and optional case flag.
   * @returns This agent instance for chaining.
   */
  addPatternHint(opts: { pattern: string; replace: string; ignoreCase?: boolean }): this {
    this.hints.push(opts as unknown as string);
    return this;
  }

  /**
   * Add a supported language to the AI configuration.
   * @param config - Language configuration including name, code, voice, and optional fillers.
   * @returns This agent instance for chaining.
   */
  addLanguage(config: LanguageConfig): this {
    const lang: Record<string, unknown> = {
      name: config.name,
      code: config.code,
    };
    if (config.voice) lang['voice'] = config.voice;
    if (config.engine) lang['engine'] = config.engine;
    if (config.fillers) lang['fillers'] = config.fillers;
    if (config.speechModel) lang['speech_model'] = config.speechModel;
    if (config.functionFillers) lang['function_fillers'] = config.functionFillers;
    this.languages.push(lang as unknown as LanguageConfig);
    return this;
  }

  /**
   * Replace all configured languages with a new list.
   * @param languages - Array of language configurations.
   * @returns This agent instance for chaining.
   */
  setLanguages(languages: LanguageConfig[]): this {
    this.languages = [];
    for (const l of languages) this.addLanguage(l);
    return this;
  }

  /**
   * Add a pronunciation override rule for the TTS engine.
   * @param rule - Pronunciation rule specifying the text to replace and its substitute.
   * @returns This agent instance for chaining.
   */
  addPronunciation(rule: PronunciationRule): this {
    const r: Record<string, unknown> = { replace: rule.replace, with: rule.with };
    if (rule.ignoreCase) r['ignore_case'] = rule.ignoreCase;
    this.pronounce.push(r as unknown as PronunciationRule);
    return this;
  }

  /**
   * Set a single AI parameter (e.g. "temperature", "top_p").
   * @param key - Parameter name.
   * @param value - Parameter value.
   * @returns This agent instance for chaining.
   */
  setParam(key: string, value: unknown): this {
    this.params[key] = value;
    return this;
  }

  /**
   * Merge multiple AI parameters into the existing params object.
   * @param params - Key-value pairs to merge.
   * @returns This agent instance for chaining.
   */
  setParams(params: Record<string, unknown>): this {
    safeAssign(this.params, params);
    return this;
  }

  /**
   * Replace the entire global_data object passed into the AI configuration.
   * @param data - New global data object.
   * @returns This agent instance for chaining.
   */
  setGlobalData(data: Record<string, unknown>): this {
    this.globalData = data;
    return this;
  }

  /**
   * Merge additional entries into the existing global_data object.
   * @param data - Key-value pairs to merge into global data.
   * @returns This agent instance for chaining.
   */
  updateGlobalData(data: Record<string, unknown>): this {
    safeAssign(this.globalData, data);
    return this;
  }

  /**
   * Set the list of native SWAIG function names (built-in platform functions).
   * @param funcs - Array of native function names.
   * @returns This agent instance for chaining.
   */
  setNativeFunctions(funcs: string[]): this {
    this.nativeFunctions = funcs;
    return this;
  }

  /**
   * Add internal filler phrases spoken while a specific function is executing.
   * @param functionName - Name of the SWAIG function these fillers apply to.
   * @param languageCode - BCP-47 language code for the fillers.
   * @param fillers - Array of filler phrases.
   * @returns This agent instance for chaining.
   */
  addInternalFiller(functionName: string, languageCode: string, fillers: string[]): this {
    if (!this.internalFillers[functionName]) {
      this.internalFillers[functionName] = {};
    }
    this.internalFillers[functionName][languageCode] = fillers;
    return this;
  }

  /**
   * Add a remote SWAIG function include reference.
   * @param url - URL of the remote SWAIG endpoint.
   * @param functions - Function names available at that endpoint.
   * @param metaData - Optional metadata to attach to the include.
   * @returns This agent instance for chaining.
   */
  addFunctionInclude(url: string, functions: string[], metaData?: Record<string, unknown>): this {
    const inc: FunctionInclude = { url, functions };
    if (metaData) inc.meta_data = metaData;
    this.functionIncludes.push(inc);
    return this;
  }

  /**
   * Merge LLM-specific parameters into the main prompt configuration (e.g. model, temperature).
   * @param params - Key-value LLM parameters to merge.
   * @returns This agent instance for chaining.
   */
  setPromptLlmParams(params: Record<string, unknown>): this {
    safeAssign(this.promptLlmParams, params);
    return this;
  }

  /**
   * Merge LLM-specific parameters into the post-prompt configuration.
   * @param params - Key-value LLM parameters to merge.
   * @returns This agent instance for chaining.
   */
  setPostPromptLlmParams(params: Record<string, unknown>): this {
    safeAssign(this.postPromptLlmParams, params);
    return this;
  }

  /**
   * Enable debug event webhooks for this agent.
   * @param level - Debug verbosity level (defaults to 1).
   * @returns This agent instance for chaining.
   */
  enableDebugEvents(level = 1): this {
    this.debugEventsEnabled = true;
    this.debugEventsLevel = level;
    return this;
  }

  // ── Tools ───────────────────────────────────────────────────────────

  /**
   * Register a SWAIG tool (function) that the AI can invoke during a call.
   * @param opts - Tool definition including name, description, parameter schema, and handler callback.
   * @returns This agent instance for chaining.
   */
  defineTool(opts: {
    name: string;
    description: string;
    parameters?: Record<string, unknown>;
    handler: SwaigHandler;
    secure?: boolean;
    fillers?: Record<string, string[]>;
    waitFile?: string;
    waitFileLoops?: number;
    required?: string[];
  }): this {
    const fn = new SwaigFunction({
      name: opts.name,
      description: opts.description,
      parameters: opts.parameters,
      handler: opts.handler,
      secure: opts.secure,
      fillers: opts.fillers,
      waitFile: opts.waitFile,
      waitFileLoops: opts.waitFileLoops,
      required: opts.required,
    });
    this.toolRegistry.set(opts.name, fn);
    return this;
  }

  /**
   * Get a summary of all registered tools with their names, descriptions, and parameter schemas.
   * @returns Array of tool descriptors.
   */
  getRegisteredTools(): { name: string; description: string; parameters: Record<string, unknown> }[] {
    const tools: { name: string; description: string; parameters: Record<string, unknown> }[] = [];
    for (const [name, fn] of this.toolRegistry) {
      if (fn instanceof SwaigFunction) {
        tools.push({ name, description: fn.description, parameters: fn.parameters });
      } else {
        tools.push({
          name,
          description: (fn['purpose'] as string) ?? '',
          parameters: (fn['argument'] as Record<string, unknown>) ?? {},
        });
      }
    }
    return tools;
  }

  /**
   * Look up a registered SwaigFunction by name.
   * @param name - The tool name to search for.
   * @returns The SwaigFunction instance, or undefined if not found or not a SwaigFunction.
   */
  getTool(name: string): SwaigFunction | undefined {
    const fn = this.toolRegistry.get(name);
    return fn instanceof SwaigFunction ? fn : undefined;
  }

  /**
   * Register a pre-built SwaigFunction instance or a raw function descriptor (e.g. DataMap).
   * @param fn - A SwaigFunction instance or a plain object with a "function" key.
   * @returns This agent instance for chaining.
   */
  registerSwaigFunction(fn: SwaigFunction | Record<string, unknown>): this {
    if (fn instanceof SwaigFunction) {
      this.toolRegistry.set(fn.name, fn);
    } else {
      const name = fn['function'] as string;
      this.toolRegistry.set(name, fn);
    }
    return this;
  }

  // ── Call flow ───────────────────────────────────────────────────────

  /**
   * Add a SWML verb to execute before the answer phase (phase 1).
   * @param verbName - Name of the SWML verb (e.g. "play", "record").
   * @param config - Verb configuration object.
   * @returns This agent instance for chaining.
   */
  addPreAnswerVerb(verbName: string, config: Record<string, unknown>): this {
    this.preAnswerVerbs.push([verbName, config]);
    return this;
  }

  /**
   * Configure the answer verb (phase 2) with optional settings.
   * @param config - Optional answer verb configuration.
   * @returns This agent instance for chaining.
   */
  addAnswerVerb(config?: Record<string, unknown>): this {
    this.answerConfig = config ?? {};
    return this;
  }

  /**
   * Add a SWML verb to execute after the answer phase but before the AI verb (phase 3).
   * @param verbName - Name of the SWML verb.
   * @param config - Verb configuration object.
   * @returns This agent instance for chaining.
   */
  addPostAnswerVerb(verbName: string, config: Record<string, unknown>): this {
    this.postAnswerVerbs.push([verbName, config]);
    return this;
  }

  /**
   * Add a SWML verb to execute after the AI verb (phase 5).
   * @param verbName - Name of the SWML verb.
   * @param config - Verb configuration object.
   * @returns This agent instance for chaining.
   */
  addPostAiVerb(verbName: string, config: Record<string, unknown>): this {
    this.postAiVerbs.push([verbName, config]);
    return this;
  }

  /**
   * Remove all pre-answer verbs.
   * @returns This agent instance for chaining.
   */
  clearPreAnswerVerbs(): this {
    this.preAnswerVerbs = [];
    return this;
  }

  /**
   * Remove all post-answer verbs.
   * @returns This agent instance for chaining.
   */
  clearPostAnswerVerbs(): this {
    this.postAnswerVerbs = [];
    return this;
  }

  /**
   * Remove all post-AI verbs.
   * @returns This agent instance for chaining.
   */
  clearPostAiVerbs(): this {
    this.postAiVerbs = [];
    return this;
  }

  /**
   * Get the agent's display name.
   * @returns The agent name string.
   */
  getName(): string {
    return this.name;
  }

  // ── Skills ─────────────────────────────────────────────────────────

  /**
   * Add a skill to this agent, registering its tools, prompt sections, hints, and global data.
   * @param skill - The skill instance to add.
   * @returns This agent instance for chaining.
   */
  async addSkill(skill: SkillBase): Promise<this> {
    await this.skillManager.addSkill(skill);

    // Register skill tools, then apply any swaigFields as extraFields on the SWAIG function
    for (const toolDef of skill.getTools()) {
      this.defineTool(toolDef);
      if (Object.keys(skill.swaigFields).length > 0) {
        const fn = this.toolRegistry.get(toolDef.name);
        if (fn instanceof SwaigFunction) {
          safeAssign(fn.extraFields, skill.swaigFields);
        }
      }
    }

    // Inject prompt sections
    for (const section of skill.getPromptSections()) {
      this.promptAddSection(section.title, section);
    }

    // Inject hints
    const hints = skill.getHints();
    if (hints.length) this.addHints(hints);

    // Merge global data
    const globalData = skill.getGlobalData();
    if (Object.keys(globalData).length) this.updateGlobalData(globalData);

    return this;
  }

  /**
   * Remove a previously added skill by its instance ID.
   * @param instanceId - The unique instance ID of the skill to remove.
   * @returns True if the skill was found and removed.
   */
  async removeSkill(instanceId: string): Promise<boolean> {
    return this.skillManager.removeSkill(instanceId);
  }

  /**
   * List all registered skills with their names, instance IDs, and initialization status.
   * @returns Array of skill descriptors.
   */
  listSkills(): { name: string; instanceId: string; initialized: boolean }[] {
    return this.skillManager.listSkills();
  }

  /**
   * Check whether a skill with the given name is registered.
   * @param skillName - The skill name to check.
   * @returns True if a skill with that name exists.
   */
  hasSkill(skillName: string): boolean {
    return this.skillManager.hasSkill(skillName);
  }

  // ── Dynamic config ──────────────────────────────────────────────────

  /**
   * Set a callback invoked on each SWML request to dynamically modify an ephemeral agent copy.
   * @param cb - The dynamic configuration callback.
   * @returns This agent instance for chaining.
   */
  setDynamicConfigCallback(cb: DynamicConfigCallback): this {
    this.dynamicConfigCallback = cb;
    return this;
  }

  /**
   * Add extra query parameters appended to all SWAIG webhook URLs.
   * @param params - Key-value pairs to append as query parameters.
   * @returns This agent instance for chaining.
   */
  addSwaigQueryParams(params: Record<string, string>): this {
    safeAssign(this.swaigQueryParams, params);
    return this;
  }

  // ── Proxy detection ────────────────────────────────────────────────

  /**
   * Manually set the proxy base URL used for webhook URL generation.
   * @param url - The external-facing base URL (trailing slashes are stripped).
   * @returns This agent instance for chaining.
   */
  manualSetProxyUrl(url: string): this {
    this._proxyUrlBase = url.replace(/\/+$/, '');
    this._proxyUrlBaseFromEnv = false;
    return this;
  }

  private detectProxyFromRequest(c: any): void {
    // Never override env var setting
    if (this._proxyUrlBaseFromEnv) return;
    // Only trust proxy headers when explicitly enabled
    if (!this._trustProxyHeaders) return;

    const get = (name: string): string | undefined =>
      c.req.header(name) ?? undefined;

    // 1. X-Forwarded-Host + X-Forwarded-Proto
    const xfHost = get('x-forwarded-host');
    if (xfHost) {
      const proto = get('x-forwarded-proto') ?? 'https';
      const url = `${proto}://${xfHost}`;
      if (this._proxyDebug) this.log.debug(`Proxy detected from X-Forwarded-Host: ${url}`);
      this._proxyUrlBase = url;
      return;
    }

    // 2. Forwarded header (RFC 7239): Forwarded: host=example.com;proto=https
    const forwarded = get('forwarded');
    if (forwarded) {
      const hostMatch = forwarded.match(/host=([^;,\s]+)/i);
      const protoMatch = forwarded.match(/proto=([^;,\s]+)/i);
      if (hostMatch && isValidHostname(hostMatch[1])) {
        const proto = protoMatch ? protoMatch[1] : 'https';
        const url = `${proto}://${hostMatch[1]}`;
        if (this._proxyDebug) this.log.debug(`Proxy detected from Forwarded header: ${url}`);
        this._proxyUrlBase = url;
        return;
      } else if (hostMatch) {
        this.log.warn(`Invalid hostname in Forwarded header: ${hostMatch[1]}`);
      }
    }

    // 3. X-Original-Host
    const xOrigHost = get('x-original-host');
    if (xOrigHost) {
      const proto = get('x-forwarded-proto') ?? 'https';
      const url = `${proto}://${xOrigHost}`;
      if (this._proxyDebug) this.log.debug(`Proxy detected from X-Original-Host: ${url}`);
      this._proxyUrlBase = url;
      return;
    }

    // 4. X-Forwarded-For (warn only - no host info)
    const xff = get('x-forwarded-for');
    if (xff && this._proxyDebug) {
      this.log.debug(`X-Forwarded-For detected (${xff}) but cannot determine host - set SWML_PROXY_URL_BASE manually`);
    }
  }

  // ── URL ─────────────────────────────────────────────────────────────

  /**
   * Override the default SWAIG webhook URL with a custom one.
   * @param url - The custom webhook URL.
   * @returns This agent instance for chaining.
   */
  setWebHookUrl(url: string): this {
    this.webHookUrlOverride = url;
    return this;
  }

  /**
   * Override the default post-prompt webhook URL with a custom one.
   * @param url - The custom post-prompt URL.
   * @returns This agent instance for chaining.
   */
  setPostPromptUrl(url: string): this {
    this.postPromptUrlOverride = url;
    return this;
  }

  /**
   * Get the full external URL of this agent, using the proxy base URL if available.
   * @param includeAuth - Whether to embed basic-auth credentials in the URL (defaults to false).
   * @returns The fully-qualified URL string.
   */
  getFullUrl(includeAuth = false): string {
    if (this._proxyUrlBase) {
      let base = this._proxyUrlBase.replace(/\/+$/, '');
      if (includeAuth) base = this.insertAuth(base);
      return base;
    }
    const protocol = this._enforceHttps ? 'https' : 'http';
    const hostPart = this.host === '0.0.0.0' ? 'localhost' : this.host;
    let base = `${protocol}://${hostPart}:${this.port}`;
    if (includeAuth) base = this.insertAuth(base);
    if (this.route && this.route !== '/') base += this.route;
    return base;
  }

  private insertAuth(baseUrl: string): string {
    const [user, pass] = this.basicAuthCreds;
    if (!user || !pass) return baseUrl;
    return baseUrl.replace('://', `://${user}:${pass}@`);
  }

  private buildWebhookUrl(endpoint: string, extraParams?: Record<string, string>): string {
    let url = `${this.getFullUrl(true)}/${endpoint}`;
    const params = { ...extraParams };
    const entries = Object.entries(params).filter(([, v]) => v);
    if (entries.length) {
      url += '?' + entries.map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&');
    }
    return url;
  }

  // ── Lifecycle hooks (override in subclass) ──────────────────────────

  /**
   * Lifecycle hook called when a post-prompt summary is received. Override in subclasses.
   * @param _summary - Parsed summary object, or null if extraction failed.
   * @param _rawData - The full raw post-prompt payload.
   */
  onSummary(_summary: Record<string, unknown> | null, _rawData: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  /**
   * Lifecycle hook called on every SWML request before rendering. Override in subclasses.
   * @param _rawData - The parsed request body.
   */
  onSwmlRequest(_rawData: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  /**
   * Lifecycle hook called when a debug event webhook is received. Override in subclasses.
   * @param _event - The debug event payload.
   */
  onDebugEvent(_event: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  /**
   * Override to add custom basic-auth validation logic beyond credential matching.
   * @param _username - The username from the request.
   * @param _password - The password from the request.
   * @returns True if the credentials are valid; false to reject the request.
   */
  validateBasicAuth(_username: string, _password: string): boolean | Promise<boolean> {
    return true;
  }

  /**
   * Pre-execution hook called before each SWAIG function. Override in subclasses.
   * @param _name - Name of the function about to execute.
   * @param _args - Parsed arguments for the function.
   * @param _rawData - The full raw SWAIG request payload.
   */
  onFunctionCall(_name: string, _args: Record<string, unknown>, _rawData: Record<string, unknown>): void | Promise<void> {
    // Default no-op
  }

  // ── 5-phase SWML rendering ─────────────────────────────────────────

  /**
   * Render the complete SWML document by assembling all 5 phases: pre-answer, answer,
   * post-answer, AI, and post-AI verbs.
   * @param callId - Optional call ID to use for session tokens; auto-generated if omitted.
   * @returns The rendered SWML document as a JSON string.
   */
  renderSwml(callId?: string): string {
    this.swmlBuilder.reset();

    const prompt = this.getPrompt();
    const postPrompt = this.getPostPrompt();
    if (!callId) callId = this.sessionManager.createSession();

    // Build webhook URLs
    const qp = { ...this.swaigQueryParams };
    let defaultWebhookUrl = this.buildWebhookUrl('swaig', qp);
    if (this.webHookUrlOverride) defaultWebhookUrl = this.webHookUrlOverride;

    // Build SWAIG object
    const swaigObj: Record<string, unknown> = {};
    if (this.nativeFunctions.length) swaigObj['native_functions'] = this.nativeFunctions;
    if (this.functionIncludes.length) swaigObj['includes'] = this.functionIncludes;
    if (Object.keys(this.internalFillers).length) swaigObj['internal_fillers'] = this.internalFillers;

    // Build functions array
    const functions: Record<string, unknown>[] = [];
    for (const [name, fn] of this.toolRegistry) {
      if (fn instanceof SwaigFunction) {
        let token: string | undefined;
        if (fn.secure && callId) {
          token = this.sessionManager.createToolToken(name, callId);
        }
        const entry: Record<string, unknown> = {
          function: name,
          description: fn.description,
          parameters: fn.parameters && Object.keys(fn.parameters).length
            ? ('type' in fn.parameters && 'properties' in fn.parameters
              ? fn.parameters
              : { type: 'object', properties: fn.parameters, ...(fn.required.length ? { required: fn.required } : {}) })
            : { type: 'object', properties: {} },
        };
        if (fn.fillers && Object.keys(fn.fillers).length) entry['fillers'] = fn.fillers;
        if (fn.waitFile) entry['wait_file'] = fn.waitFile;
        if (fn.waitFileLoops !== undefined) entry['wait_file_loops'] = fn.waitFileLoops;
        if (fn.webhookUrl) {
          entry['web_hook_url'] = fn.webhookUrl;
        } else if (token || Object.keys(this.swaigQueryParams).length) {
          const urlParams = { ...this.swaigQueryParams };
          if (token) urlParams['__token'] = token;
          entry['web_hook_url'] = this.buildWebhookUrl('swaig', urlParams);
        }
        safeAssign(entry, fn.extraFields);
        functions.push(entry);
      } else {
        // Raw dict (DataMap) - use as-is
        const entry = { ...fn, function: name };
        functions.push(entry);
      }
    }

    if (functions.length) {
      swaigObj['functions'] = functions;
      swaigObj['defaults'] = { web_hook_url: defaultWebhookUrl };
    }

    // Build post-prompt URL
    let postPromptUrl: string | undefined;
    if (postPrompt) {
      const ppParams = { ...this.swaigQueryParams };
      if (callId) {
        const ppToken = this.sessionManager.createToolToken('post_prompt', callId);
        if (ppToken) ppParams['__token'] = ppToken;
      }
      postPromptUrl = this.buildWebhookUrl('post_prompt', ppParams);
      if (this.postPromptUrlOverride) postPromptUrl = this.postPromptUrlOverride;
    }

    // ── PHASE 1: Pre-answer verbs ──
    for (const [verb, config] of this.preAnswerVerbs) {
      this.swmlBuilder.addVerb(verb, config);
    }

    // ── PHASE 2: Answer verb ──
    if (this.autoAnswer) {
      this.swmlBuilder.addVerb('answer', this.answerConfig);
    }

    // ── PHASE 3: Post-answer verbs ──
    if (this._recordCall) {
      this.swmlBuilder.addVerb('record_call', {
        format: this.recordFormat,
        stereo: this.recordStereo,
      });
    }
    for (const [verb, config] of this.postAnswerVerbs) {
      this.swmlBuilder.addVerb(verb, config);
    }

    // ── PHASE 4: AI verb ──
    const aiConfig: Record<string, unknown> = {};

    // Prompt
    if (this.contextsBuilder) {
      const contextsDict = this.contextsBuilder.toDict();
      const promptObj: Record<string, unknown> = { text: prompt || `You are ${this.name}, a helpful AI assistant.` };
      if (Object.keys(this.promptLlmParams).length) Object.assign(promptObj, this.promptLlmParams);
      aiConfig['prompt'] = promptObj;
      aiConfig['contexts'] = contextsDict;
    } else {
      const promptObj: Record<string, unknown> = { text: prompt };
      if (Object.keys(this.promptLlmParams).length) Object.assign(promptObj, this.promptLlmParams);
      aiConfig['prompt'] = promptObj;
    }

    // Post-prompt
    if (postPrompt) {
      const ppObj: Record<string, unknown> = { text: postPrompt };
      if (Object.keys(this.postPromptLlmParams).length) Object.assign(ppObj, this.postPromptLlmParams);
      aiConfig['post_prompt'] = ppObj;
      if (postPromptUrl) aiConfig['post_prompt_url'] = postPromptUrl;
    }

    // SWAIG
    if (Object.keys(swaigObj).length) aiConfig['SWAIG'] = swaigObj;

    // Additional config
    if (this.hints.length) aiConfig['hints'] = this.hints;
    if (this.languages.length) aiConfig['languages'] = this.languages;
    if (this.pronounce.length) aiConfig['pronounce'] = this.pronounce;
    if (Object.keys(this.params).length) aiConfig['params'] = this.params;
    if (Object.keys(this.globalData).length) aiConfig['global_data'] = this.globalData;

    // Debug events
    if (this.debugEventsEnabled) {
      aiConfig['debug_webhook_url'] = this.buildWebhookUrl('debug_events');
      aiConfig['debug_webhook_level'] = this.debugEventsLevel;
    }

    this.swmlBuilder.addVerb('ai', aiConfig);

    // ── PHASE 5: Post-AI verbs ──
    for (const [verb, config] of this.postAiVerbs) {
      this.swmlBuilder.addVerb(verb, config);
    }

    return this.swmlBuilder.renderDocument();
  }

  // ── Ephemeral copy for dynamic config ───────────────────────────────

  private createEphemeralCopy(): AgentBase {
    const copy = Object.create(Object.getPrototypeOf(this)) as AgentBase;
    Object.assign(copy, this);
    // Deep-copy mutable state
    copy.promptManager = new PromptManager(true);
    // Carry over the current prompt
    const p = this.getPrompt();
    if (p) copy.promptManager.setPromptText(p);
    const pp = this.getPostPrompt();
    if (pp) copy.promptManager.setPostPrompt(pp);
    copy.toolRegistry = new Map(this.toolRegistry);
    copy.hints = [...this.hints];
    copy.languages = [...this.languages];
    copy.pronounce = [...this.pronounce];
    copy.params = { ...this.params };
    copy.globalData = { ...this.globalData };
    copy.preAnswerVerbs = [...this.preAnswerVerbs];
    copy.postAnswerVerbs = [...this.postAnswerVerbs];
    copy.postAiVerbs = [...this.postAiVerbs];
    copy.swmlBuilder = new SwmlBuilder();

    // Replay skills into the ephemeral copy so dynamic config callbacks can modify them
    copy.skillManager = new SkillManager();
    for (const entry of this.skillManager.getLoadedSkillEntries()) {
      try {
        const skill = new (entry.SkillClass as any)(entry.config);
        // Synchronous re-add: mark initialized, register tools/prompts/hints/data
        skill.markInitialized();
        copy.skillManager.addSkill(skill).catch(() => { /* swallow async errors in sync context */ });

        for (const toolDef of skill.getTools()) {
          copy.defineTool(toolDef);
          if (Object.keys(skill.swaigFields).length > 0) {
            const fn = copy.toolRegistry.get(toolDef.name);
            if (fn instanceof SwaigFunction) {
              safeAssign(fn.extraFields, skill.swaigFields);
            }
          }
        }
        for (const section of skill.getPromptSections()) {
          copy.promptAddSection(section.title, section);
        }
        const hints = skill.getHints();
        if (hints.length) copy.addHints(hints);
        const globalData = skill.getGlobalData();
        if (Object.keys(globalData).length) copy.updateGlobalData(globalData);
      } catch (e) {
        this.log.warn(`Failed to replay skill '${entry.skillName}' in ephemeral copy: ${e}`);
      }
    }

    return copy;
  }

  // ── Hono HTTP app ───────────────────────────────────────────────────

  /**
   * Get or lazily create the Hono HTTP application with all routes, middleware, auth, and CORS.
   * @returns The configured Hono application instance.
   */
  getApp(): Hono {
    if (this._app) return this._app;

    const app = new Hono();

    // Security headers
    const requestTimeout = parseInt(process.env['SWML_REQUEST_TIMEOUT'] ?? '30000', 10);
    const maxRequestSize = parseInt(process.env['SWML_MAX_REQUEST_SIZE'] ?? '1048576', 10);
    app.use('*', async (c, next) => {
      await next();
      c.res.headers.set('X-Content-Type-Options', 'nosniff');
      c.res.headers.set('X-Frame-Options', 'DENY');
      c.res.headers.set('X-XSS-Protection', '1; mode=block');
      c.res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
      c.res.headers.set('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      c.res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    });

    // Request size limit
    app.use('*', async (c, next) => {
      const contentLength = c.req.header('content-length');
      const size = parseInt(contentLength ?? '', 10);
      if (contentLength && (isNaN(size) || size > maxRequestSize)) {
        return c.json({ error: 'Request too large' }, 413);
      }
      await next();
    });

    // Allowed hosts (configurable via env)
    const allowedHosts = process.env['SWML_ALLOWED_HOSTS'];
    if (allowedHosts) {
      const hostSet = new Set(allowedHosts.split(',').map(h => h.trim().toLowerCase()));
      app.use('*', async (c, next) => {
        const host = (c.req.header('host') ?? '').split(':')[0].toLowerCase();
        if (!hostSet.has(host)) {
          return c.json({ error: 'Forbidden: host not allowed' }, 403);
        }
        await next();
      });
    }

    // Rate limiting (configurable via env, requests per minute per IP)
    const rateLimitStr = process.env['SWML_RATE_LIMIT'];
    if (rateLimitStr) {
      const maxPerMinute = parseInt(rateLimitStr, 10);
      if (maxPerMinute > 0) {
        const hits = new Map<string, { count: number; resetAt: number }>();
        app.use('*', async (c, next) => {
          const ip = this._trustProxyHeaders
            ? (c.req.header('x-forwarded-for')?.split(',')[0].trim()
              ?? c.req.header('x-real-ip')
              ?? 'unknown')
            : 'unknown';
          const now = Date.now();
          let entry = hits.get(ip);
          if (!entry || now >= entry.resetAt) {
            entry = { count: 0, resetAt: now + 60_000 };
            hits.set(ip, entry);
          }
          // Cleanup if map grows too large
          if (hits.size > 10000) {
            for (const [k, v] of hits) {
              if (now >= v.resetAt) hits.delete(k);
            }
          }
          entry.count++;
          if (entry.count > maxPerMinute) {
            return c.json({ error: 'Rate limit exceeded' }, 429);
          }
          await next();
        });
      }
    }

    // CORS (configurable via env)
    const corsOrigins = process.env['SWML_CORS_ORIGINS'];
    const corsOrigin = corsOrigins ? corsOrigins.split(',').map(o => o.trim()) : '*';
    const corsCredentials = corsOrigin !== '*';
    app.use('*', cors({ origin: corsOrigin, credentials: corsCredentials }));

    // CSRF protection (optional, gated by env)
    if (process.env['SWML_CSRF_PROTECTION'] === 'true') {
      const allowedOrigins = corsOrigins
        ? new Set(corsOrigins.split(',').map(o => o.trim().toLowerCase()))
        : null;
      app.use('*', async (c, next) => {
        if (c.req.method === 'POST') {
          const origin = c.req.header('origin');
          if (origin && allowedOrigins && !allowedOrigins.has(origin.toLowerCase())) {
            return c.json({ error: 'Origin not allowed' }, 403);
          }
        }
        await next();
      });
    }

    // Auth middleware
    const [user, pass] = this.basicAuthCreds;
    const authMw = basicAuth({ username: user, password: pass });

    const basePath = this.route === '/' ? '' : this.route;

    // Root - returns SWML
    const handleSwml = async (c: any) => {
      let reqLog = this.log.bind({ endpoint: this.route });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* GET or no body */ }

      reqLog.debug('request_body_received', { body_size: JSON.stringify(body).length });

      this.detectProxyFromRequest(c);
      await this.onSwmlRequest(body);

      const callId = (body['call_id'] as string) || undefined;
      if (callId) reqLog = reqLog.bind({ call_id: callId });

      let agentToUse: AgentBase = this;
      if (this.dynamicConfigCallback) {
        agentToUse = this.createEphemeralCopy();
        const queryParams: Record<string, string> = {};
        const url = new URL(c.req.url);
        url.searchParams.forEach((v: string, k: string) => { queryParams[k] = v; });
        const rawHeaders: Record<string, string> = {};
        c.req.raw.headers.forEach((v: string, k: string) => { rawHeaders[k] = v; });
        const headers = filterSensitiveHeaders(rawHeaders);
        await this.dynamicConfigCallback(queryParams, body, headers, agentToUse);
        reqLog.debug('dynamic_config_complete');
      }

      const swml = agentToUse.renderSwml(callId);
      reqLog.debug('swml_rendered', { swml_size: swml.length });
      reqLog.info('request_successful');
      return c.json(JSON.parse(swml));
    };

    app.get(`${basePath}`, authMw, handleSwml);
    app.post(`${basePath}`, authMw, handleSwml);
    if (basePath) {
      app.get(`${basePath}/`, authMw, handleSwml);
      app.post(`${basePath}/`, authMw, handleSwml);
    }

    // SWAIG function dispatcher
    const handleSwaig = async (c: any) => {
      let reqLog = this.log.bind({ endpoint: `${basePath}/swaig` });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      const fnName = body['function'] as string;
      if (!fnName) return c.json({ error: 'Missing function name' }, 400);
      if (fnName.length > 128) return c.json({ error: 'Invalid function name' }, 400);
      if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fnName)) {
        reqLog.warn('invalid_function_name_format', { function: fnName });
        return c.json({ error: 'Invalid function name' }, 400);
      }

      reqLog = reqLog.bind({ function: fnName });
      reqLog.debug('function_call_received');

      const callIdStr = (body['call_id'] as string) ?? '';
      if (callIdStr) reqLog = reqLog.bind({ call_id: callIdStr });

      const fn = this.toolRegistry.get(fnName);
      if (!fn || !(fn instanceof SwaigFunction)) {
        reqLog.warn('function_not_found', { requested: fnName });
        return c.json({ error: `Unknown function: ${fnName}` }, 404);
      }

      // Token validation for secure functions
      if (fn.secure) {
        const url = new URL(c.req.url);
        const token = url.searchParams.get('__token') ?? url.searchParams.get('token');
        if (!token) {
          reqLog.warn('missing_token');
          const result = new SwaigFunctionResult(
            'The security token for this function is missing or expired. This action cannot be completed.'
          );
          return c.json(result.toDict());
        }
        if (!this.sessionManager.validateToken(callIdStr, fnName, token)) {
          reqLog.warn('token_invalid');
          const result = new SwaigFunctionResult(
            'The security token for this function is invalid or expired. This action cannot be completed.'
          );
          return c.json(result.toDict());
        }
        reqLog.debug('token_valid');
      }

      const rawArgs = body['argument'];
      const args: Record<string, unknown> =
        (rawArgs !== null && typeof rawArgs === 'object' && !Array.isArray(rawArgs))
          ? rawArgs as Record<string, unknown>
          : {};
      reqLog.debug('executing_function', { args: JSON.stringify(args) });
      await this.onFunctionCall(fnName, args, body);

      try {
        const result = await fn.execute(args, body);
        reqLog.info('function_executed_successfully');
        reqLog.debug('function_result', { result_size: JSON.stringify(result).length });
        return c.json(result);
      } catch (err) {
        reqLog.error('function_execution_error', { error: err instanceof Error ? err.message : String(err) });
        return c.json({ error: 'Function execution failed' }, 500);
      }
    };

    app.get(`${basePath}/swaig`, authMw, handleSwaig);
    app.post(`${basePath}/swaig`, authMw, handleSwaig);

    // Post-prompt handler
    const handlePostPrompt = async (c: any) => {
      let reqLog = this.log.bind({ endpoint: `${basePath}/post_prompt` });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      const callId = (body['call_id'] as string) || undefined;
      if (callId) reqLog = reqLog.bind({ call_id: callId });

      reqLog.info('post_prompt_received');

      const summary = this.findSummary(body);
      await this.onSummary(summary, body);
      return c.json({ ok: true });
    };

    app.get(`${basePath}/post_prompt`, authMw, handlePostPrompt);
    app.post(`${basePath}/post_prompt`, authMw, handlePostPrompt);

    // Debug events handler
    const handleDebugEvents = async (c: any) => {
      const reqLog = this.log.bind({ endpoint: `${basePath}/debug_events` });
      reqLog.debug('endpoint_called');

      let body: Record<string, unknown> = {};
      try { body = await c.req.json(); } catch { /* empty */ }

      reqLog.debug('debug_event_received', body);
      await this.onDebugEvent(body);
      return c.json({ ok: true });
    };

    app.post(`${basePath}/debug_events`, authMw, handleDebugEvents);

    // Health / Ready
    app.get(`${basePath}/health`, (c: any) => c.json({ status: 'ok' }));
    app.get(`${basePath}/ready`, (c: any) => c.json({ status: 'ready' }));

    this._app = app;
    return app;
  }

  /**
   * Return this agent's Hono app for mounting as a sub-router in an AgentServer.
   * @returns The Hono application instance.
   */
  asRouter(): Hono {
    return this.getApp();
  }

  /**
   * Start the HTTP server and begin listening for requests.
   * @returns A promise that resolves once the server is running.
   */
  async serve(): Promise<void> {
    // When loaded by the CLI tool, skip server startup — only the agent config is needed.
    if (process.env['SWAIG_CLI_MODE'] === 'true') return;

    const { serve: honoServe } = await import('@hono/node-server');
    const app = this.getApp();
    const listenUrl = `http://${this.host}:${this.port}${this.route}`;
    this.log.info(`Agent '${this.name}' running at ${listenUrl}`);
    this.log.info(`Auth: ${this.basicAuthCreds[0]}:**** (source: ${this.basicAuthSource})`);
    if (this._proxyUrlBase) {
      this.log.info(`Proxy URL: ${redactUrl(this._proxyUrlBase)}`);
    }
    honoServe({ fetch: app.fetch, port: this.port, hostname: this.host });
  }

  /**
   * Alias for {@link serve}. Starts the HTTP server.
   * @returns A promise that resolves once the server is running.
   */
  async run(): Promise<void> {
    return this.serve();
  }

  // ── Graceful shutdown ─────────────────────────────────────────────

  private static _shutdownRegistered = false;

  /**
   * Register process signal handlers for clean Kubernetes/Docker shutdown.
   * Handles SIGTERM and SIGINT, waits for a timeout, then exits.
   * @param opts - Optional timeout in milliseconds (default 5000).
   */
  static setupGracefulShutdown(opts?: { timeout?: number }): void {
    if (AgentBase._shutdownRegistered) return;
    AgentBase._shutdownRegistered = true;

    const timeout = opts?.timeout ?? 5000;
    const log = getLogger('GracefulShutdown');

    const handler = (signal: string) => {
      log.info(`Received ${signal}, shutting down in ${timeout}ms...`);
      setTimeout(() => {
        log.info('Shutdown complete.');
        process.exit(0);
      }, timeout);
    };

    process.on('SIGTERM', () => handler('SIGTERM'));
    process.on('SIGINT', () => handler('SIGINT'));
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private findSummary(body: Record<string, unknown>): Record<string, unknown> | null {
    if (!body) return null;
    if (body['summary']) return body['summary'] as Record<string, unknown>;
    const ppd = body['post_prompt_data'] as Record<string, unknown> | undefined;
    if (ppd) {
      if (Array.isArray(ppd['parsed']) && ppd['parsed'].length) return ppd['parsed'][0];
      if (ppd['raw']) {
        try {
          return JSON.parse(ppd['raw'] as string);
        } catch {
          return ppd['raw'] as Record<string, unknown>;
        }
      }
    }
    return null;
  }

  /**
   * Get the basic-auth credentials used by this agent.
   * @param includeSource - When true, a third element indicating the credential source is appended.
   * @returns A tuple of [username, password] or [username, password, source].
   */
  getBasicAuthCredentials(includeSource?: false): [string, string];
  getBasicAuthCredentials(includeSource: true): [string, string, 'provided' | 'environment' | 'generated'];
  getBasicAuthCredentials(includeSource?: boolean): [string, string] | [string, string, 'provided' | 'environment' | 'generated'] {
    if (includeSource) return [...this.basicAuthCreds, this.basicAuthSource];
    return this.basicAuthCreds;
  }
}
