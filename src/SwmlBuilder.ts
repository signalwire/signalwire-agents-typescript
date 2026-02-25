/**
 * SwmlBuilder - Builds SWML (SignalWire Markup Language) documents.
 *
 * Produces `{ version: "1.0.0", sections: { main: [...verbs] } }`.
 */

/** Builds SWML documents composed of verb instructions organized into named sections. */
export class SwmlBuilder {
  private document: { version: string; sections: Record<string, unknown[]> };

  /** Creates a new SwmlBuilder with an empty SWML document. */
  constructor() {
    this.document = this.createEmpty();
  }

  private createEmpty() {
    return { version: '1.0.0', sections: { main: [] as unknown[] } };
  }

  /** Resets the document to an empty SWML structure. */
  reset(): void {
    this.document = this.createEmpty();
  }

  /**
   * Appends a verb to the main section.
   * @param verbName - The SWML verb name (e.g., "answer", "ai").
   * @param config - The verb's configuration payload.
   */
  addVerb(verbName: string, config: unknown): void {
    this.document.sections['main'].push({ [verbName]: config });
  }

  /**
   * Appends a verb to a named section, creating the section if it does not exist.
   * @param sectionName - The target section name.
   * @param verbName - The SWML verb name.
   * @param config - The verb's configuration payload.
   */
  addVerbToSection(sectionName: string, verbName: string, config: unknown): void {
    if (!this.document.sections[sectionName]) {
      this.document.sections[sectionName] = [];
    }
    this.document.sections[sectionName].push({ [verbName]: config });
  }

  /**
   * Returns the raw SWML document object.
   * @returns The document with version and sections.
   */
  getDocument(): Record<string, unknown> {
    return this.document;
  }

  /**
   * Serializes the SWML document to a JSON string.
   * @returns The JSON-encoded SWML document.
   */
  renderDocument(): string {
    return JSON.stringify(this.document);
  }
}
