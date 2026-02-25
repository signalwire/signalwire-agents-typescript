/**
 * ConciergeAgent - A prefab agent that provides multi-department routing
 * with a knowledge base of department info, hours, and transfer capabilities.
 */

import { AgentBase } from '../AgentBase.js';
import { SwaigFunctionResult } from '../SwaigFunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface Department {
  /** Department name (e.g. "Sales", "Support"). */
  name: string;
  /** Description of what this department handles. */
  description: string;
  /** Phone number or SIP address for transfers. */
  transferNumber?: string;
  /** Keywords that help route callers to this department. */
  keywords?: string[];
  /** Human-readable hours of operation (e.g. "Mon-Fri 9am-5pm EST"). */
  hoursOfOperation?: string;
}

export interface ConciergeConfig {
  /** Agent display name. */
  name?: string;
  /** List of departments available for routing. */
  departments: Department[];
  /** Company name used in greetings and prompts. */
  companyName?: string;
  /** General company information the agent can share. */
  generalInfo?: string;
  /** Message spoken when a department is closed or unavailable. */
  afterHoursMessage?: string;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Agent ───────────────────────────────────────────────────────────────────

export class ConciergeAgent extends AgentBase {
  private departments: Department[];
  private companyName: string;
  private generalInfo: string;
  private afterHoursMessage: string;

  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a professional concierge agent. Help callers find the right department, provide information about available services, and transfer calls when requested.',
    },
    {
      title: 'Rules',
      bullets: [
        'Greet the caller warmly and ask how you can help.',
        'Use list_departments to describe available departments if the caller is unsure where to go.',
        'Use get_department_info to provide detailed information about a specific department.',
        'Use transfer_to_department to connect the caller to the right department.',
        'If a department has hours of operation listed, mention them before transferring.',
        'If a department does not have a transfer number, inform the caller and offer alternatives.',
        'Be polite, professional, and efficient.',
      ],
    },
  ];

  constructor(config: ConciergeConfig) {
    const agentName = config.name ?? 'Concierge';
    super({
      name: agentName,
      ...config.agentOptions,
    });

    this.departments = config.departments;
    this.companyName = config.companyName ?? 'our company';
    this.generalInfo = config.generalInfo ?? '';
    this.afterHoursMessage = config.afterHoursMessage ?? 'This department is currently closed. Please try again during business hours.';

    // Company intro section
    let introBody = `You are the concierge for ${this.companyName}.`;
    if (this.generalInfo) {
      introBody += ` Company information: ${this.generalInfo}`;
    }
    this.promptAddSection('Company', { body: introBody });

    // Build department overview section
    const deptBullets = this.departments.map((dept) => {
      let desc = `${dept.name}: ${dept.description}`;
      if (dept.hoursOfOperation) desc += ` (Hours: ${dept.hoursOfOperation})`;
      if (dept.transferNumber) desc += ' [transfer available]';
      return desc;
    });
    this.promptAddSection('Available Departments', { bullets: deptBullets });

    // Speech recognition hints from department names and keywords
    const hints: string[] = this.departments.map((d) => d.name);
    for (const dept of this.departments) {
      if (dept.keywords) hints.push(...dept.keywords);
    }
    this.addHints(hints);

    // Register tools after all fields are initialized
    this.defineTools();
  }

  // ── Department helpers ────────────────────────────────────────────────

  private findDepartment(name: string): Department | undefined {
    const normalized = name.toLowerCase().trim();
    return this.departments.find(
      (d) =>
        d.name.toLowerCase() === normalized ||
        d.keywords?.some((k) => k.toLowerCase() === normalized),
    );
  }

  // ── Tool registration ─────────────────────────────────────────────────

  protected override defineTools(): void {
    // Tool: list_departments
    this.defineTool({
      name: 'list_departments',
      description: `List all available departments at ${this.companyName} with their descriptions and hours of operation.`,
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: () => {
        if (this.departments.length === 0) {
          return new SwaigFunctionResult('No departments are currently configured.');
        }

        const lines = this.departments.map((dept) => {
          let line = `${dept.name}: ${dept.description}`;
          if (dept.hoursOfOperation) line += ` | Hours: ${dept.hoursOfOperation}`;
          if (!dept.transferNumber) line += ' | (no direct transfer available)';
          return line;
        });

        return new SwaigFunctionResult(
          `Available departments at ${this.companyName}:\n${lines.join('\n')}`,
        );
      },
    });

    // Tool: get_department_info
    this.defineTool({
      name: 'get_department_info',
      description: 'Get detailed information about a specific department including description, hours of operation, and transfer availability.',
      parameters: {
        type: 'object',
        properties: {
          department_name: {
            type: 'string',
            description: 'The name of the department to look up.',
          },
        },
        required: ['department_name'],
      },
      handler: (_args: Record<string, unknown>) => {
        const deptName = _args['department_name'] as string;
        if (!deptName) {
          return new SwaigFunctionResult('Please provide a department name.');
        }

        const dept = this.findDepartment(deptName);
        if (!dept) {
          const available = this.departments.map((d) => d.name).join(', ');
          return new SwaigFunctionResult(
            `Department "${deptName}" not found. Available departments: ${available}`,
          );
        }

        let info = `Department: ${dept.name}\nDescription: ${dept.description}`;
        if (dept.hoursOfOperation) info += `\nHours: ${dept.hoursOfOperation}`;
        if (dept.transferNumber) {
          info += '\nTransfer: available';
        } else {
          info += '\nTransfer: not available (no phone number configured)';
        }
        if (dept.keywords && dept.keywords.length > 0) {
          info += `\nRelated topics: ${dept.keywords.join(', ')}`;
        }

        return new SwaigFunctionResult(info);
      },
    });

    // Tool: transfer_to_department
    this.defineTool({
      name: 'transfer_to_department',
      description: 'Transfer the caller to a specific department. Only works if the department has a transfer number configured.',
      parameters: {
        type: 'object',
        properties: {
          department_name: {
            type: 'string',
            description: 'The name of the department to transfer to.',
          },
        },
        required: ['department_name'],
      },
      handler: (_args: Record<string, unknown>) => {
        const deptName = _args['department_name'] as string;
        if (!deptName) {
          return new SwaigFunctionResult('Please provide a department name.');
        }

        const dept = this.findDepartment(deptName);
        if (!dept) {
          const available = this.departments.map((d) => d.name).join(', ');
          return new SwaigFunctionResult(
            `Department "${deptName}" not found. Available departments: ${available}`,
          );
        }

        if (!dept.transferNumber) {
          return new SwaigFunctionResult(
            `The ${dept.name} department does not have a direct transfer number. ${this.afterHoursMessage}`,
          );
        }

        const result = new SwaigFunctionResult(
          `Transferring you to the ${dept.name} department now.`,
        );
        result.connect(dept.transferNumber);
        return result;
      },
    });
  }
}

// ── Factory function ────────────────────────────────────────────────────────

export function createConciergeAgent(config: ConciergeConfig): ConciergeAgent {
  return new ConciergeAgent(config);
}

export default ConciergeAgent;
