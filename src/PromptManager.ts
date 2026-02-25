/**
 * PromptManager - Manages agent prompts with POM support.
 *
 * Holds either raw prompt text or a PomBuilder for structured prompts.
 */

import { PomBuilder } from './PomBuilder.js';

/** Manages agent prompt text, supporting both raw text and structured POM-based prompts. */
export class PromptManager {
  private rawText: string | null = null;
  private postPrompt: string | null = null;
  private pom: PomBuilder | null = null;
  private usePom: boolean;

  /**
   * Creates a new PromptManager.
   * @param usePom - Whether to use structured POM sections (default true).
   */
  constructor(usePom = true) {
    this.usePom = usePom;
    if (usePom) {
      this.pom = new PomBuilder();
    }
  }

  /**
   * Sets the raw prompt text, bypassing POM rendering.
   * @param text - The raw prompt string.
   */
  setPromptText(text: string): void {
    this.rawText = text;
  }

  /**
   * Sets the post-prompt text appended after the main prompt.
   * @param text - The post-prompt string.
   */
  setPostPrompt(text: string): void {
    this.postPrompt = text;
  }

  /**
   * Adds a POM section to the prompt, initializing the PomBuilder if needed.
   * @param title - The section heading.
   * @param opts - Optional body, bullets, numbering, and subsection configuration.
   */
  addSection(
    title: string,
    opts?: {
      body?: string;
      bullets?: string[];
      numbered?: boolean;
      numberedBullets?: boolean;
      subsections?: { title: string; body?: string; bullets?: string[] }[];
    },
  ): void {
    if (!this.pom) {
      this.pom = new PomBuilder();
      this.usePom = true;
    }
    this.pom.addSection(title, opts);
  }

  /**
   * Appends body text or bullets to an existing POM section, creating it if absent.
   * @param title - The section heading to append to.
   * @param opts - Body text and/or bullets to add.
   */
  addToSection(
    title: string,
    opts?: { body?: string; bullet?: string; bullets?: string[] },
  ): void {
    if (!this.pom) {
      this.pom = new PomBuilder();
      this.usePom = true;
    }
    this.pom.addToSection(title, opts);
  }

  /**
   * Adds a subsection under a parent POM section, creating the parent if absent.
   * @param parentTitle - The heading of the parent section.
   * @param title - The subsection heading.
   * @param opts - Optional body text and bullets for the subsection.
   */
  addSubsection(
    parentTitle: string,
    title: string,
    opts?: { body?: string; bullets?: string[] },
  ): void {
    if (!this.pom) {
      this.pom = new PomBuilder();
      this.usePom = true;
    }
    this.pom.addSubsection(parentTitle, title, opts);
  }

  /**
   * Checks whether a POM section with the given title exists.
   * @param title - The section heading to look for.
   * @returns True if the section exists.
   */
  hasSection(title: string): boolean {
    return this.pom?.hasSection(title) ?? false;
  }

  /**
   * Returns the fully rendered prompt text, either raw text or POM-rendered Markdown.
   * @returns The prompt string, or empty string if nothing is set.
   */
  getPrompt(): string {
    if (this.rawText !== null) return this.rawText;
    if (this.pom) return this.pom.renderMarkdown();
    return '';
  }

  /**
   * Returns the post-prompt text.
   * @returns The post-prompt string, or null if not set.
   */
  getPostPrompt(): string | null {
    return this.postPrompt;
  }

  /**
   * Returns the underlying PomBuilder instance, if POM mode is active.
   * @returns The PomBuilder, or null if POM is not in use.
   */
  getPomBuilder(): PomBuilder | null {
    return this.pom;
  }
}
