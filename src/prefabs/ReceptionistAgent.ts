/**
 * ReceptionistAgent - A prefab front-desk agent that handles visitor
 * check-in, department directory lookup, and call transfers by extension.
 */

import { AgentBase } from '../AgentBase.js';
import { SwaigFunctionResult } from '../SwaigFunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface ReceptionistDepartment {
  /** Department name (e.g. "Engineering", "HR"). */
  name: string;
  /** Internal extension number or SIP address. */
  extension: string;
  /** Optional description of the department. */
  description?: string;
}

export interface ReceptionistConfig {
  /** Agent display name. */
  name?: string;
  /** Company name displayed in greetings and prompts. */
  companyName: string;
  /** Departments with extensions for the directory. */
  departments: ReceptionistDepartment[];
  /** Custom welcome message. */
  welcomeMessage?: string;
  /** Whether visitor check-in functionality is enabled. Default true. */
  checkInEnabled?: boolean;
  /** Callback fired when a visitor checks in. */
  onVisitorCheckIn?: (visitor: Record<string, string>) => void | Promise<void>;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Per-call state for check-ins ────────────────────────────────────────────

interface CheckInSession {
  visitors: Record<string, string>[];
}

// ── Agent ───────────────────────────────────────────────────────────────────

export class ReceptionistAgent extends AgentBase {
  private companyName: string;
  private departments: ReceptionistDepartment[];
  private welcomeMessage: string;
  private checkInEnabled: boolean;
  private onVisitorCheckInCallback?: (visitor: Record<string, string>) => void | Promise<void>;
  private sessions: Map<string, CheckInSession> = new Map();

  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a friendly and professional receptionist. Greet visitors warmly, help them check in, look up department information, and transfer calls to the appropriate extension.',
    },
    {
      title: 'Rules',
      bullets: [
        'Always greet the caller with the company welcome message.',
        'If a caller wants to reach a department, use get_department_list to find the right one, then transfer_to_department.',
        'If a caller wants to check in as a visitor, collect their name, purpose of visit, and who they are visiting, then use check_in_visitor.',
        'Be warm, helpful, and professional at all times.',
        'If you are unsure which department the caller needs, offer to list all departments.',
        'Confirm the department name before transferring.',
      ],
    },
  ];

  constructor(config: ReceptionistConfig) {
    const agentName = config.name ?? 'Receptionist';
    super({
      name: agentName,
      ...config.agentOptions,
    });

    this.companyName = config.companyName;
    this.departments = config.departments;
    this.welcomeMessage = config.welcomeMessage ?? `Welcome to ${this.companyName}! How may I help you today?`;
    this.checkInEnabled = config.checkInEnabled ?? true;
    this.onVisitorCheckInCallback = config.onVisitorCheckIn;

    // Welcome section
    this.promptAddSection('Welcome', {
      body: `You are the receptionist for ${this.companyName}. Greet callers with: "${this.welcomeMessage}"`,
    });

    // Department directory section
    const deptBullets = this.departments.map((dept) => {
      let line = `${dept.name} (ext: ${dept.extension})`;
      if (dept.description) line += ` - ${dept.description}`;
      return line;
    });
    this.promptAddSection('Department Directory', { bullets: deptBullets });

    if (this.checkInEnabled) {
      this.promptAddSection('Visitor Check-In', {
        body: 'If a caller wants to check in as a visitor, collect their full name, the purpose of their visit, and the name of the person they are visiting. Then use the check_in_visitor tool.',
      });
    }

    // Speech recognition hints
    const hints: string[] = [this.companyName];
    hints.push(...this.departments.map((d) => d.name));
    this.addHints(hints);

    // Register tools after all fields are initialized
    this.defineTools();
  }

  // ── Session helpers ───────────────────────────────────────────────────

  private getSession(rawData: Record<string, unknown>): CheckInSession {
    const callId = (rawData['call_id'] as string) ?? 'default';
    let session = this.sessions.get(callId);
    if (!session) {
      session = { visitors: [] };
      this.sessions.set(callId, session);
    }
    return session;
  }

  // ── Department helpers ────────────────────────────────────────────────

  private findDepartment(name: string): ReceptionistDepartment | undefined {
    const normalized = name.toLowerCase().trim();
    return this.departments.find((d) => d.name.toLowerCase() === normalized);
  }

  // ── Tool registration ─────────────────────────────────────────────────

  protected override defineTools(): void {
    // Tool: get_department_list
    this.defineTool({
      name: 'get_department_list',
      description: `List all departments at ${this.companyName} with their extensions and descriptions.`,
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: () => {
        if (this.departments.length === 0) {
          return new SwaigFunctionResult('No departments are currently listed in the directory.');
        }

        const lines = this.departments.map((dept) => {
          let line = `${dept.name} - Extension: ${dept.extension}`;
          if (dept.description) line += ` (${dept.description})`;
          return line;
        });

        return new SwaigFunctionResult(
          `Department directory for ${this.companyName}:\n${lines.join('\n')}`,
        );
      },
    });

    // Tool: transfer_to_department
    this.defineTool({
      name: 'transfer_to_department',
      description: 'Transfer the caller to a department by dialing its extension.',
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
          return new SwaigFunctionResult('Please provide a department name to transfer to.');
        }

        const dept = this.findDepartment(deptName);
        if (!dept) {
          const available = this.departments.map((d) => d.name).join(', ');
          return new SwaigFunctionResult(
            `Department "${deptName}" not found in the directory. Available departments: ${available}`,
          );
        }

        const result = new SwaigFunctionResult(
          `Transferring you to ${dept.name} at extension ${dept.extension}. One moment please.`,
        );
        result.connect(dept.extension);
        return result;
      },
    });

    // Tool: check_in_visitor (only if enabled)
    if (this.checkInEnabled) {
      this.defineTool({
        name: 'check_in_visitor',
        description: 'Check in a visitor by recording their name, purpose of visit, and who they are visiting.',
        parameters: {
          type: 'object',
          properties: {
            visitor_name: {
              type: 'string',
              description: 'Full name of the visitor.',
            },
            purpose: {
              type: 'string',
              description: 'Purpose of the visit.',
            },
            visiting: {
              type: 'string',
              description: 'Name of the person or department the visitor is here to see.',
            },
          },
          required: ['visitor_name', 'purpose', 'visiting'],
        },
        handler: async (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
          const visitorName = _args['visitor_name'] as string;
          const purpose = _args['purpose'] as string;
          const visiting = _args['visiting'] as string;

          if (!visitorName || !purpose || !visiting) {
            return new SwaigFunctionResult(
              'Please provide the visitor\'s name, purpose of visit, and who they are visiting.',
            );
          }

          const visitorRecord: Record<string, string> = {
            visitor_name: visitorName,
            purpose,
            visiting,
            checked_in_at: new Date().toISOString(),
          };

          // Store in session
          const session = this.getSession(rawData);
          session.visitors.push(visitorRecord);

          // Fire callback
          if (this.onVisitorCheckInCallback) {
            try {
              await this.onVisitorCheckInCallback(visitorRecord);
            } catch (err) {
              this.log.error(`onVisitorCheckIn callback error: ${err}`);
            }
          }

          return new SwaigFunctionResult(
            `Visitor checked in successfully! Name: ${visitorName}, Purpose: ${purpose}, Visiting: ${visiting}. Welcome to ${this.companyName}!`,
          );
        },
      });
    }
  }
}

// ── Factory function ────────────────────────────────────────────────────────

export function createReceptionistAgent(config: ReceptionistConfig): ReceptionistAgent {
  return new ReceptionistAgent(config);
}

export default ReceptionistAgent;
