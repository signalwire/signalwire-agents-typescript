/**
 * ContextBuilder - Contexts and Steps workflow system.
 *
 * Contexts contain ordered Steps, each with prompt text/POM sections,
 * completion criteria, function restrictions, and navigation rules.
 */

const MAX_CONTEXTS = 50;
const MAX_STEPS_PER_CONTEXT = 100;

// ── GatherQuestion ──────────────────────────────────────────────────

/** Represents a single question within a gather operation. */
export class GatherQuestion {
  /** Unique key used to store the answer. */
  key: string;
  /** The question text presented to the user. */
  question: string;
  /** Expected answer type (e.g., "string", "number"). */
  type: string;
  /** Whether the answer requires user confirmation. */
  confirm: boolean;
  /** Optional additional prompt context for this question. */
  prompt?: string;
  /** Optional list of SWAIG function names available during this question. */
  functions?: string[];

  /**
   * Creates a new GatherQuestion.
   * @param opts - Question configuration including key, question text, and optional type/confirm/prompt/functions.
   */
  constructor(opts: {
    key: string;
    question: string;
    type?: string;
    confirm?: boolean;
    prompt?: string;
    functions?: string[];
  }) {
    this.key = opts.key;
    this.question = opts.question;
    this.type = opts.type ?? 'string';
    this.confirm = opts.confirm ?? false;
    this.prompt = opts.prompt;
    this.functions = opts.functions;
  }

  /**
   * Serializes this question to a plain object for SWML output.
   * @returns A dictionary representation of this question.
   */
  toDict(): Record<string, unknown> {
    const d: Record<string, unknown> = { key: this.key, question: this.question };
    if (this.type !== 'string') d['type'] = this.type;
    if (this.confirm) d['confirm'] = true;
    if (this.prompt) d['prompt'] = this.prompt;
    if (this.functions) d['functions'] = this.functions;
    return d;
  }
}

// ── GatherInfo ──────────────────────────────────────────────────────

/** Collects structured information from the user through a series of questions. */
export class GatherInfo {
  private questions: GatherQuestion[] = [];
  private outputKey?: string;
  private completionAction?: string;
  private prompt?: string;

  /**
   * Creates a new GatherInfo.
   * @param opts - Optional output key, completion action, and prompt configuration.
   */
  constructor(opts?: { outputKey?: string; completionAction?: string; prompt?: string }) {
    this.outputKey = opts?.outputKey;
    this.completionAction = opts?.completionAction;
    this.prompt = opts?.prompt;
  }

  /**
   * Adds a question to this gather operation.
   * @param opts - Question configuration including key, question text, and optional type/confirm/prompt/functions.
   * @returns This GatherInfo for chaining.
   */
  addQuestion(opts: {
    key: string;
    question: string;
    type?: string;
    confirm?: boolean;
    prompt?: string;
    functions?: string[];
  }): this {
    this.questions.push(new GatherQuestion(opts));
    return this;
  }

  /**
   * Returns all questions in this gather operation.
   * @returns The array of GatherQuestion instances.
   */
  getQuestions(): GatherQuestion[] {
    return this.questions;
  }

  /**
   * Serializes this gather operation to a plain object for SWML output.
   * @returns A dictionary representation of the gather info and its questions.
   */
  toDict(): Record<string, unknown> {
    if (!this.questions.length) throw new Error('gather_info must have at least one question');
    const d: Record<string, unknown> = { questions: this.questions.map((q) => q.toDict()) };
    if (this.prompt) d['prompt'] = this.prompt;
    if (this.outputKey) d['output_key'] = this.outputKey;
    if (this.completionAction) d['completion_action'] = this.completionAction;
    return d;
  }
}

// ── Step ────────────────────────────────────────────────────────────

/** Internal structure for a POM-like section within a step or context. */
interface StepSection {
  /** Section heading text. */
  title: string;
  /** Section body paragraph text. */
  body?: string;
  /** List of bullet point strings. */
  bullets?: string[];
}

/** A single step within a context, with prompt content, criteria, function restrictions, and navigation rules. */
export class Step {
  /** The unique name identifying this step within its context. */
  name: string;
  private text: string | null = null;
  private stepCriteria: string | null = null;
  private functions: string | string[] | null = null;
  private validSteps: string[] | null = null;
  private validContexts: string[] | null = null;
  private sections: StepSection[] = [];
  private gatherInfo: GatherInfo | null = null;
  private _end = false;
  private skipUserTurn = false;
  private _skipToNextStep = false;
  private resetSystemPrompt: string | null = null;
  private resetUserPrompt: string | null = null;
  private resetConsolidate = false;
  private resetFullReset = false;

  /**
   * Creates a new Step.
   * @param name - The unique step name.
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Sets raw text content for this step, mutually exclusive with POM sections.
   * @param text - The raw prompt text.
   * @returns This step for chaining.
   */
  setText(text: string): this {
    if (this.sections.length) throw new Error('Cannot use setText() when POM sections have been added.');
    this.text = text;
    return this;
  }

  /**
   * Adds a POM section with a body, mutually exclusive with raw text.
   * @param title - The section heading.
   * @param body - The section body text.
   * @returns This step for chaining.
   */
  addSection(title: string, body: string): this {
    if (this.text !== null) throw new Error('Cannot add POM sections when setText() has been used.');
    this.sections.push({ title, body });
    return this;
  }

  /**
   * Adds a POM section with bullet points, mutually exclusive with raw text.
   * @param title - The section heading.
   * @param bullets - The list of bullet point strings.
   * @returns This step for chaining.
   */
  addBullets(title: string, bullets: string[]): this {
    if (this.text !== null) throw new Error('Cannot add POM sections when setText() has been used.');
    this.sections.push({ title, bullets });
    return this;
  }

  /**
   * Sets the criteria that must be met before this step is considered complete.
   * @param criteria - A description of the completion criteria.
   * @returns This step for chaining.
   */
  setStepCriteria(criteria: string): this {
    this.stepCriteria = criteria;
    return this;
  }

  /**
   * Restricts which SWAIG functions are available during this step.
   * @param functions - A function name, list of names, or "*" for all.
   * @returns This step for chaining.
   */
  setFunctions(functions: string | string[]): this {
    this.functions = functions;
    return this;
  }

  /**
   * Sets which steps the AI may navigate to from this step.
   * @param steps - List of allowed step names.
   * @returns This step for chaining.
   */
  setValidSteps(steps: string[]): this {
    this.validSteps = steps;
    return this;
  }

  /**
   * Sets which contexts the AI may navigate to from this step.
   * @param contexts - List of allowed context names.
   * @returns This step for chaining.
   */
  setValidContexts(contexts: string[]): this {
    this.validContexts = contexts;
    return this;
  }

  /**
   * Marks this step as an end step, terminating the conversation when reached.
   * @param end - Whether this is an end step.
   * @returns This step for chaining.
   */
  setEnd(end: boolean): this {
    this._end = end;
    return this;
  }

  /**
   * Sets whether to skip waiting for user input when entering this step.
   * @param skip - Whether to skip the user turn.
   * @returns This step for chaining.
   */
  setSkipUserTurn(skip: boolean): this {
    this.skipUserTurn = skip;
    return this;
  }

  /**
   * Sets whether to automatically advance to the next step after this one completes.
   * @param skip - Whether to skip to the next step.
   * @returns This step for chaining.
   */
  setSkipToNextStep(skip: boolean): this {
    this._skipToNextStep = skip;
    return this;
  }

  /**
   * Initializes a gather info operation on this step for collecting structured data.
   * @param opts - Optional output key, completion action, and prompt configuration.
   * @returns This step for chaining.
   */
  setGatherInfo(opts?: { outputKey?: string; completionAction?: string; prompt?: string }): this {
    this.gatherInfo = new GatherInfo(opts);
    return this;
  }

  /**
   * Adds a question to this step's gather info operation.
   * @param opts - Question configuration including key, question text, and optional type/confirm/prompt/functions.
   * @returns This step for chaining.
   */
  addGatherQuestion(opts: {
    key: string;
    question: string;
    type?: string;
    confirm?: boolean;
    prompt?: string;
    functions?: string[];
  }): this {
    if (!this.gatherInfo) throw new Error('Must call setGatherInfo() before addGatherQuestion()');
    this.gatherInfo.addQuestion(opts);
    return this;
  }

  /**
   * Removes all POM sections and raw text from this step.
   * @returns This step for chaining.
   */
  clearSections(): this {
    this.sections = [];
    this.text = null;
    return this;
  }

  /**
   * Sets the system prompt to use when resetting context at this step.
   * @param systemPrompt - The replacement system prompt text.
   * @returns This step for chaining.
   */
  setResetSystemPrompt(systemPrompt: string): this {
    this.resetSystemPrompt = systemPrompt;
    return this;
  }

  /**
   * Sets the user prompt to use when resetting context at this step.
   * @param userPrompt - The replacement user prompt text.
   * @returns This step for chaining.
   */
  setResetUserPrompt(userPrompt: string): this {
    this.resetUserPrompt = userPrompt;
    return this;
  }

  /**
   * Sets whether to consolidate conversation history when resetting at this step.
   * @param consolidate - Whether to consolidate.
   * @returns This step for chaining.
   */
  setResetConsolidate(consolidate: boolean): this {
    this.resetConsolidate = consolidate;
    return this;
  }

  /**
   * Sets whether to perform a full conversation reset at this step.
   * @param fullReset - Whether to fully reset.
   * @returns This step for chaining.
   */
  setResetFullReset(fullReset: boolean): this {
    this.resetFullReset = fullReset;
    return this;
  }

  private renderText(): string {
    if (this.text !== null) return this.text;
    if (!this.sections.length) throw new Error(`Step '${this.name}' has no text or POM sections defined`);
    const parts: string[] = [];
    for (const section of this.sections) {
      parts.push(`## ${section.title}`);
      if (section.bullets) {
        for (const b of section.bullets) parts.push(`- ${b}`);
      } else if (section.body) {
        parts.push(section.body);
      }
      parts.push('');
    }
    return parts.join('\n').trim();
  }

  /**
   * Serializes this step to a plain object for SWML output.
   * @returns A dictionary representation of this step.
   */
  toDict(): Record<string, unknown> {
    const d: Record<string, unknown> = { name: this.name, text: this.renderText() };
    if (this.stepCriteria) d['step_criteria'] = this.stepCriteria;
    if (this.functions !== null) d['functions'] = this.functions;
    if (this.validSteps !== null) d['valid_steps'] = this.validSteps;
    if (this.validContexts !== null) d['valid_contexts'] = this.validContexts;
    if (this._end) d['end'] = true;
    if (this.skipUserTurn) d['skip_user_turn'] = true;
    if (this._skipToNextStep) d['skip_to_next_step'] = true;

    const reset: Record<string, unknown> = {};
    if (this.resetSystemPrompt !== null) reset['system_prompt'] = this.resetSystemPrompt;
    if (this.resetUserPrompt !== null) reset['user_prompt'] = this.resetUserPrompt;
    if (this.resetConsolidate) reset['consolidate'] = true;
    if (this.resetFullReset) reset['full_reset'] = true;
    if (Object.keys(reset).length) d['reset'] = reset;

    if (this.gatherInfo) d['gather_info'] = this.gatherInfo.toDict();
    return d;
  }
}

// ── Context ─────────────────────────────────────────────────────────

/** A named context containing ordered steps, prompt configuration, and navigation rules. */
export class Context {
  /** The unique name identifying this context. */
  name: string;
  private steps: Map<string, Step> = new Map();
  private stepOrder: string[] = [];
  private _validContexts: string[] | null = null;
  private _validSteps: string[] | null = null;
  private _postPrompt: string | null = null;
  private _systemPrompt: string | null = null;
  private systemPromptSections: StepSection[] = [];
  private _consolidate = false;
  private _fullReset = false;
  private _userPrompt: string | null = null;
  private _isolated = false;
  private promptText: string | null = null;
  private promptSections: StepSection[] = [];
  private _enterFillers: Record<string, string[]> | null = null;
  private _exitFillers: Record<string, string[]> | null = null;

  /**
   * Creates a new Context.
   * @param name - The unique context name.
   */
  constructor(name: string) {
    this.name = name;
  }

  /**
   * Adds a new step to this context.
   * @param name - The unique step name within this context.
   * @param opts - Optional shorthand for task text, bullets, criteria, functions, and valid steps.
   * @returns The newly created Step for further configuration.
   */
  addStep(
    name: string,
    opts?: {
      task?: string;
      bullets?: string[];
      criteria?: string;
      functions?: string | string[];
      validSteps?: string[];
    },
  ): Step {
    if (this.steps.size >= MAX_STEPS_PER_CONTEXT) {
      throw new Error(`Maximum steps per context (${MAX_STEPS_PER_CONTEXT}) exceeded`);
    }
    if (this.steps.has(name)) throw new Error(`Step '${name}' already exists in context '${this.name}'`);
    const step = new Step(name);
    this.steps.set(name, step);
    this.stepOrder.push(name);
    if (opts?.task) step.addSection('Task', opts.task);
    if (opts?.bullets) step.addBullets('Process', opts.bullets);
    if (opts?.criteria) step.setStepCriteria(opts.criteria);
    if (opts?.functions) step.setFunctions(opts.functions);
    if (opts?.validSteps) step.setValidSteps(opts.validSteps);
    return step;
  }

  /**
   * Returns a step by name.
   * @param name - The step name to retrieve.
   * @returns The matching Step, or undefined if not found.
   */
  getStep(name: string): Step | undefined {
    return this.steps.get(name);
  }

  /**
   * Removes a step from this context by name.
   * @param name - The step name to remove.
   * @returns This context for chaining.
   */
  removeStep(name: string): this {
    this.steps.delete(name);
    this.stepOrder = this.stepOrder.filter((s) => s !== name);
    return this;
  }

  /**
   * Moves a step to a new position in the step order.
   * @param name - The step name to move.
   * @param position - The zero-based index to insert at.
   * @returns This context for chaining.
   */
  moveStep(name: string, position: number): this {
    if (!this.steps.has(name)) throw new Error(`Step '${name}' not found in context '${this.name}'`);
    this.stepOrder = this.stepOrder.filter((s) => s !== name);
    this.stepOrder.splice(position, 0, name);
    return this;
  }

  /**
   * Sets which contexts the AI may navigate to from this context.
   * @param contexts - List of allowed context names.
   * @returns This context for chaining.
   */
  setValidContexts(contexts: string[]): this {
    this._validContexts = contexts;
    return this;
  }

  /**
   * Sets which steps the AI may navigate to from this context.
   * @param steps - List of allowed step names.
   * @returns This context for chaining.
   */
  setValidSteps(steps: string[]): this {
    this._validSteps = steps;
    return this;
  }

  /**
   * Sets the post-prompt text for this context.
   * @param postPrompt - The post-prompt string.
   * @returns This context for chaining.
   */
  setPostPrompt(postPrompt: string): this {
    this._postPrompt = postPrompt;
    return this;
  }

  /**
   * Sets raw system prompt text, mutually exclusive with system POM sections.
   * @param systemPrompt - The system prompt string.
   * @returns This context for chaining.
   */
  setSystemPrompt(systemPrompt: string): this {
    if (this.systemPromptSections.length) throw new Error('Cannot use setSystemPrompt() when POM sections have been added.');
    this._systemPrompt = systemPrompt;
    return this;
  }

  /**
   * Sets whether to consolidate conversation history when entering this context.
   * @param consolidate - Whether to consolidate.
   * @returns This context for chaining.
   */
  setConsolidate(consolidate: boolean): this {
    this._consolidate = consolidate;
    return this;
  }

  /**
   * Sets whether to fully reset conversation history when entering this context.
   * @param fullReset - Whether to fully reset.
   * @returns This context for chaining.
   */
  setFullReset(fullReset: boolean): this {
    this._fullReset = fullReset;
    return this;
  }

  /**
   * Sets the user prompt text for this context.
   * @param userPrompt - The user prompt string.
   * @returns This context for chaining.
   */
  setUserPrompt(userPrompt: string): this {
    this._userPrompt = userPrompt;
    return this;
  }

  /**
   * Sets whether this context is isolated from other contexts' conversation history.
   * @param isolated - Whether to isolate.
   * @returns This context for chaining.
   */
  setIsolated(isolated: boolean): this {
    this._isolated = isolated;
    return this;
  }

  /**
   * Adds a POM section to the system prompt, mutually exclusive with raw system prompt text.
   * @param title - The section heading.
   * @param body - The section body text.
   * @returns This context for chaining.
   */
  addSystemSection(title: string, body: string): this {
    if (this._systemPrompt !== null) throw new Error('Cannot add POM sections when setSystemPrompt() has been used.');
    this.systemPromptSections.push({ title, body });
    return this;
  }

  /**
   * Adds a POM section with bullets to the system prompt, mutually exclusive with raw system prompt text.
   * @param title - The section heading.
   * @param bullets - The list of bullet point strings.
   * @returns This context for chaining.
   */
  addSystemBullets(title: string, bullets: string[]): this {
    if (this._systemPrompt !== null) throw new Error('Cannot add POM sections when setSystemPrompt() has been used.');
    this.systemPromptSections.push({ title, bullets });
    return this;
  }

  /**
   * Sets raw prompt text for this context, mutually exclusive with POM prompt sections.
   * @param prompt - The prompt string.
   * @returns This context for chaining.
   */
  setPrompt(prompt: string): this {
    if (this.promptSections.length) throw new Error('Cannot use setPrompt() when POM sections have been added.');
    this.promptText = prompt;
    return this;
  }

  /**
   * Adds a POM section with a body to the context prompt, mutually exclusive with raw prompt text.
   * @param title - The section heading.
   * @param body - The section body text.
   * @returns This context for chaining.
   */
  addSection(title: string, body: string): this {
    if (this.promptText !== null) throw new Error('Cannot add POM sections when setPrompt() has been used.');
    this.promptSections.push({ title, body });
    return this;
  }

  /**
   * Adds a POM section with bullets to the context prompt, mutually exclusive with raw prompt text.
   * @param title - The section heading.
   * @param bullets - The list of bullet point strings.
   * @returns This context for chaining.
   */
  addBullets(title: string, bullets: string[]): this {
    if (this.promptText !== null) throw new Error('Cannot add POM sections when setPrompt() has been used.');
    this.promptSections.push({ title, bullets });
    return this;
  }

  /**
   * Sets filler phrases spoken when entering this context, keyed by language code.
   * @param fillers - Map of language codes to arrays of filler phrases.
   * @returns This context for chaining.
   */
  setEnterFillers(fillers: Record<string, string[]>): this {
    this._enterFillers = fillers;
    return this;
  }

  /**
   * Sets filler phrases spoken when exiting this context, keyed by language code.
   * @param fillers - Map of language codes to arrays of filler phrases.
   * @returns This context for chaining.
   */
  setExitFillers(fillers: Record<string, string[]>): this {
    this._exitFillers = fillers;
    return this;
  }

  /**
   * Adds enter filler phrases for a specific language.
   * @param languageCode - The language code (e.g., "en-US").
   * @param fillers - Array of filler phrases.
   * @returns This context for chaining.
   */
  addEnterFiller(languageCode: string, fillers: string[]): this {
    if (!this._enterFillers) this._enterFillers = {};
    this._enterFillers[languageCode] = fillers;
    return this;
  }

  /**
   * Adds exit filler phrases for a specific language.
   * @param languageCode - The language code (e.g., "en-US").
   * @param fillers - Array of filler phrases.
   * @returns This context for chaining.
   */
  addExitFiller(languageCode: string, fillers: string[]): this {
    if (!this._exitFillers) this._exitFillers = {};
    this._exitFillers[languageCode] = fillers;
    return this;
  }

  /** @internal */
  getSteps(): Map<string, Step> {
    return this.steps;
  }

  /** @internal */
  getValidContexts(): string[] | null {
    return this._validContexts;
  }

  private renderPrompt(): string | null {
    if (this.promptText !== null) return this.promptText;
    if (!this.promptSections.length) return null;
    return this.renderSections(this.promptSections);
  }

  private renderSystemPrompt(): string | null {
    if (this._systemPrompt !== null) return this._systemPrompt;
    if (!this.systemPromptSections.length) return null;
    return this.renderSections(this.systemPromptSections);
  }

  private renderSections(sections: StepSection[]): string {
    const parts: string[] = [];
    for (const s of sections) {
      parts.push(`## ${s.title}`);
      if (s.bullets) for (const b of s.bullets) parts.push(`- ${b}`);
      else if (s.body) parts.push(s.body);
      parts.push('');
    }
    return parts.join('\n').trim();
  }

  /**
   * Serializes this context and all its steps to a plain object for SWML output.
   * @returns A dictionary representation of this context.
   */
  toDict(): Record<string, unknown> {
    if (!this.steps.size) throw new Error(`Context '${this.name}' has no steps defined`);
    const d: Record<string, unknown> = {
      steps: this.stepOrder.map((name) => this.steps.get(name)!.toDict()),
    };
    if (this._validContexts !== null) d['valid_contexts'] = this._validContexts;
    if (this._validSteps !== null) d['valid_steps'] = this._validSteps;
    if (this._postPrompt !== null) d['post_prompt'] = this._postPrompt;
    const sp = this.renderSystemPrompt();
    if (sp !== null) d['system_prompt'] = sp;
    if (this._consolidate) d['consolidate'] = true;
    if (this._fullReset) d['full_reset'] = true;
    if (this._userPrompt !== null) d['user_prompt'] = this._userPrompt;
    if (this._isolated) d['isolated'] = true;
    if (this.promptSections.length) {
      d['pom'] = this.promptSections;
    } else if (this.promptText !== null) {
      d['prompt'] = this.promptText;
    }
    if (this._enterFillers) d['enter_fillers'] = this._enterFillers;
    if (this._exitFillers) d['exit_fillers'] = this._exitFillers;
    return d;
  }
}

// ── ContextBuilder ──────────────────────────────────────────────────

/** Builds and validates a collection of named contexts for multi-step AI workflows. */
export class ContextBuilder {
  private contexts: Map<string, Context> = new Map();
  private contextOrder: string[] = [];

  /**
   * Adds a new named context to the builder.
   * @param name - The unique context name.
   * @returns The newly created Context for further configuration.
   */
  addContext(name: string): Context {
    if (this.contexts.size >= MAX_CONTEXTS) {
      throw new Error(`Maximum number of contexts (${MAX_CONTEXTS}) exceeded`);
    }
    if (this.contexts.has(name)) throw new Error(`Context '${name}' already exists`);
    const ctx = new Context(name);
    this.contexts.set(name, ctx);
    this.contextOrder.push(name);
    return ctx;
  }

  /**
   * Returns a context by name.
   * @param name - The context name to retrieve.
   * @returns The matching Context, or undefined if not found.
   */
  getContext(name: string): Context | undefined {
    return this.contexts.get(name);
  }

  /**
   * Validates that all contexts have steps, naming constraints are met, and cross-context references are valid.
   * @throws Error if validation fails.
   */
  validate(): void {
    if (!this.contexts.size) throw new Error('At least one context must be defined');
    if (this.contexts.size === 1) {
      const name = [...this.contexts.keys()][0];
      if (name !== 'default') throw new Error("When using a single context, it must be named 'default'");
    }
    for (const [name, ctx] of this.contexts) {
      if (!ctx.getSteps().size) throw new Error(`Context '${name}' must have at least one step`);
    }
    // Validate context references
    for (const [, ctx] of this.contexts) {
      const vc = ctx.getValidContexts();
      if (vc) {
        for (const ref of vc) {
          if (!this.contexts.has(ref)) {
            throw new Error(`Context '${ctx.name}' references unknown context '${ref}'`);
          }
        }
      }
    }
  }

  /**
   * Validates and serializes all contexts to a plain object for SWML output.
   * @returns A dictionary mapping context names to their serialized representations.
   */
  toDict(): Record<string, unknown> {
    this.validate();
    const result: Record<string, unknown> = {};
    for (const name of this.contextOrder) {
      result[name] = this.contexts.get(name)!.toDict();
    }
    return result;
  }
}

// ── Helper ──────────────────────────────────────────────────────────

/**
 * Creates a standalone Context instance without a ContextBuilder.
 * @param name - The context name (defaults to "default").
 * @returns A new Context instance.
 */
export function createSimpleContext(name = 'default'): Context {
  return new Context(name);
}
