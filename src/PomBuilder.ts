/**
 * PomBuilder - Prompt Object Model for structured prompt sections.
 *
 * Built-in replacement for the external signalwire-pom package.
 * Sections have a title, body, bullets (optionally numbered),
 * and nested subsections.
 */

/** Serializable representation of a POM section, used for JSON export. */
export interface PomSectionData {
  /** Section heading text. */
  title?: string;
  /** Section body paragraph text. */
  body?: string;
  /** List of bullet point strings. */
  bullets?: string[];
  /** Whether subsections are numbered. */
  numbered?: boolean;
  /** Whether bullet points are rendered as a numbered list. */
  numberedBullets?: boolean;
  /** Nested child sections. */
  subsections?: PomSectionData[];
}

/** A single section in a Prompt Object Model, with optional title, body, bullets, and nested subsections. */
export class PomSection {
  /** Section heading text, or null if untitled. */
  title: string | null;
  /** Section body paragraph text. */
  body: string;
  /** List of bullet point strings. */
  bullets: string[];
  /** Nested child sections. */
  subsections: PomSection[];
  /** Whether this section is numbered when rendered; null means inherit from parent context. */
  numbered: boolean | null;
  /** Whether bullet points are rendered as a numbered list. */
  numberedBullets: boolean;

  /**
   * Creates a new PomSection.
   * @param opts - Optional section configuration.
   */
  constructor(opts?: {
    title?: string | null;
    body?: string;
    bullets?: string[];
    numbered?: boolean | null;
    numberedBullets?: boolean;
  }) {
    this.title = opts?.title ?? null;
    this.body = opts?.body ?? '';
    this.bullets = opts?.bullets ?? [];
    this.subsections = [];
    this.numbered = opts?.numbered ?? null;
    this.numberedBullets = opts?.numberedBullets ?? false;
  }

  /**
   * Adds a nested subsection to this section.
   * @param opts - Subsection configuration including title and optional body/bullets.
   * @returns The newly created child PomSection.
   */
  addSubsection(opts: {
    title: string;
    body?: string;
    bullets?: string[];
    numbered?: boolean;
    numberedBullets?: boolean;
  }): PomSection {
    const sub = new PomSection({
      title: opts.title,
      body: opts.body,
      bullets: opts.bullets,
      numbered: opts.numbered ?? false,
      numberedBullets: opts.numberedBullets ?? false,
    });
    this.subsections.push(sub);
    return sub;
  }

  /**
   * Serializes this section to a plain data object.
   * @returns A PomSectionData representation of this section and its subsections.
   */
  toDict(): PomSectionData {
    const data: PomSectionData = {};
    if (this.body) data.body = this.body;
    if (this.bullets.length) data.bullets = this.bullets;
    if (this.subsections.length) data.subsections = this.subsections.map((s) => s.toDict());
    if (this.title !== null) data.title = this.title;
    if (this.numbered) data.numbered = this.numbered;
    if (this.numberedBullets) data.numberedBullets = this.numberedBullets;
    return data;
  }

  /**
   * Renders this section and its subsections as a Markdown string.
   * @param level - The heading level to start at (default 2 for ##).
   * @param sectionNumber - Hierarchical numbering prefix for numbered sections.
   * @returns The rendered Markdown string.
   */
  renderMarkdown(level = 2, sectionNumber: number[] = []): string {
    const lines: string[] = [];

    if (this.title !== null) {
      const prefix = sectionNumber.length ? `${sectionNumber.join('.')}. ` : '';
      lines.push(`${'#'.repeat(level)} ${prefix}${this.title}\n`);
    }

    if (this.body) {
      lines.push(`${this.body}\n`);
    }

    for (let i = 0; i < this.bullets.length; i++) {
      if (this.numberedBullets) {
        lines.push(`${i + 1}. ${this.bullets[i]}`);
      } else {
        lines.push(`- ${this.bullets[i]}`);
      }
    }
    if (this.bullets.length) lines.push('');

    const anyNumbered = this.subsections.some((s) => s.numbered);
    for (let i = 0; i < this.subsections.length; i++) {
      const sub = this.subsections[i];
      let newNumber: number[];
      let nextLevel: number;
      if (this.title !== null || sectionNumber.length) {
        if (anyNumbered && sub.numbered !== false) {
          newNumber = [...sectionNumber, i + 1];
        } else {
          newNumber = sectionNumber;
        }
        nextLevel = level + 1;
      } else {
        newNumber = sectionNumber;
        nextLevel = level;
      }
      lines.push(sub.renderMarkdown(nextLevel, newNumber));
    }

    return lines.join('\n');
  }
}

/** Builds a structured prompt by composing named POM sections, with Markdown and dict export. */
export class PomBuilder {
  private sections: PomSection[] = [];
  private sectionMap: Map<string, PomSection> = new Map();

  /**
   * Adds a new top-level section to the prompt.
   * @param title - The section heading.
   * @param opts - Optional body, bullets, numbering, and subsection configuration.
   * @returns This builder for chaining.
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
  ): this {
    const section = new PomSection({
      title,
      body: opts?.body,
      bullets: opts?.bullets,
      numbered: opts?.numbered,
      numberedBullets: opts?.numberedBullets,
    });
    this.sections.push(section);
    this.sectionMap.set(title, section);

    if (opts?.subsections) {
      for (const sub of opts.subsections) {
        section.addSubsection({
          title: sub.title,
          body: sub.body,
          bullets: sub.bullets,
        });
      }
    }
    return this;
  }

  /**
   * Appends body text or bullets to an existing section, creating it if absent.
   * @param title - The section heading to append to.
   * @param opts - Body text and/or bullets to add.
   * @returns This builder for chaining.
   */
  addToSection(
    title: string,
    opts?: { body?: string; bullet?: string; bullets?: string[] },
  ): this {
    if (!this.sectionMap.has(title)) {
      this.addSection(title);
    }
    const section = this.sectionMap.get(title)!;
    if (opts?.body) {
      section.body = section.body ? `${section.body}\n\n${opts.body}` : opts.body;
    }
    if (opts?.bullet) section.bullets.push(opts.bullet);
    if (opts?.bullets) section.bullets.push(...opts.bullets);
    return this;
  }

  /**
   * Adds a subsection under an existing parent section, creating the parent if absent.
   * @param parentTitle - The heading of the parent section.
   * @param title - The subsection heading.
   * @param opts - Optional body text and bullets for the subsection.
   * @returns This builder for chaining.
   */
  addSubsection(
    parentTitle: string,
    title: string,
    opts?: { body?: string; bullets?: string[] },
  ): this {
    if (!this.sectionMap.has(parentTitle)) {
      this.addSection(parentTitle);
    }
    this.sectionMap.get(parentTitle)!.addSubsection({
      title,
      body: opts?.body,
      bullets: opts?.bullets,
    });
    return this;
  }

  /**
   * Checks whether a top-level section with the given title exists.
   * @param title - The section heading to look for.
   * @returns True if the section exists.
   */
  hasSection(title: string): boolean {
    return this.sectionMap.has(title);
  }

  /**
   * Returns a top-level section by title.
   * @param title - The section heading to retrieve.
   * @returns The matching PomSection, or undefined if not found.
   */
  getSection(title: string): PomSection | undefined {
    return this.sectionMap.get(title);
  }

  /**
   * Recursively searches all sections and subsections for one matching the given title.
   * @param title - The section heading to search for.
   * @returns The matching PomSection, or undefined if not found.
   */
  findSection(title: string): PomSection | undefined {
    const recurse = (sections: PomSection[]): PomSection | undefined => {
      for (const s of sections) {
        if (s.title === title) return s;
        const found = recurse(s.subsections);
        if (found) return found;
      }
      return undefined;
    };
    return recurse(this.sections);
  }

  /**
   * Serializes all sections to an array of plain data objects.
   * @returns An array of PomSectionData representing all top-level sections.
   */
  toDict(): PomSectionData[] {
    return this.sections.map((s) => s.toDict());
  }

  /**
   * Renders all sections as a combined Markdown string.
   * @returns The complete rendered Markdown prompt text.
   */
  renderMarkdown(): string {
    const anyNumbered = this.sections.some((s) => s.numbered);
    const parts: string[] = [];
    let counter = 0;
    for (const section of this.sections) {
      let sectionNumber: number[] = [];
      if (section.title !== null) {
        counter++;
        if (anyNumbered && section.numbered !== false) {
          sectionNumber = [counter];
        }
      }
      parts.push(section.renderMarkdown(2, sectionNumber));
    }
    return parts.join('\n');
  }
}
