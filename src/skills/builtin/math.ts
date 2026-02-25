/**
 * Math Skill - Evaluates mathematical expressions safely.
 *
 * Tier 1 built-in skill: no external dependencies required.
 * Uses a safe parser that only allows digits, basic arithmetic operators,
 * parentheses, decimal points, and spaces.
 */

import { SkillBase } from '../SkillBase.js';
import type {
  SkillManifest,
  SkillToolDefinition,
  SkillPromptSection,
  SkillConfig,
} from '../SkillBase.js';
import { SwaigFunctionResult } from '../../SwaigFunctionResult.js';

/**
 * Validate that an expression contains only safe mathematical characters.
 * Allowed: digits (0-9), operators (+, -, *, /, ^, %), parentheses, decimal points, spaces.
 */
function isSafeExpression(expr: string): boolean {
  return /^[\d+\-*/^%().\s]+$/.test(expr);
}

/**
 * Safely evaluate a mathematical expression.
 * Replaces ^ with ** for exponentiation, then evaluates using Function constructor
 * after validating the expression contains only safe characters.
 */
function safeEvaluate(expr: string): number {
  const trimmed = expr.trim();

  if (trimmed.length === 0) {
    throw new Error('Expression is empty.');
  }

  if (!isSafeExpression(trimmed)) {
    throw new Error(
      'Expression contains invalid characters. Only digits, operators (+, -, *, /, ^, %), parentheses, decimal points, and spaces are allowed.',
    );
  }

  // Replace ^ with ** for exponentiation support
  const normalized = trimmed.replace(/\^/g, '**');

  // Use Function constructor (safer than eval, and we have already validated the input)
  const fn = new Function(`"use strict"; return (${normalized});`) as () => unknown;
  const result = fn();

  if (typeof result !== 'number' || !isFinite(result)) {
    throw new Error('Expression did not evaluate to a finite number.');
  }

  return result;
}

export class MathSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('math', config);
  }

  getManifest(): SkillManifest {
    return {
      name: 'math',
      description: 'Evaluates mathematical expressions with basic arithmetic operations.',
      version: '1.0.0',
      tags: ['utility', 'math', 'calculator'],
    };
  }

  getTools(): SkillToolDefinition[] {
    return [
      {
        name: 'calculate',
        description:
          'Evaluate a mathematical expression. Supports basic arithmetic: addition (+), subtraction (-), multiplication (*), division (/), exponentiation (^), modulo (%), and parentheses for grouping.',
        parameters: {
          expression: {
            type: 'string',
            description:
              'The mathematical expression to evaluate (e.g., "2 + 3 * 4", "100 / (5 + 5)", "2 ^ 10").',
          },
        },
        required: ['expression'],
        handler: (args: Record<string, unknown>) => {
          const expression = args.expression as string | undefined;

          if (!expression || typeof expression !== 'string') {
            return new SwaigFunctionResult(
              'Please provide a mathematical expression to evaluate.',
            );
          }

          try {
            const result = safeEvaluate(expression);
            return new SwaigFunctionResult(
              `The result of ${expression.trim()} is ${result}.`,
            );
          } catch (err) {
            const message = err instanceof Error ? err.message : String(err);
            return new SwaigFunctionResult(
              `Could not evaluate the expression "${expression}": ${message}`,
            );
          }
        },
      },
    ];
  }

  getPromptSections(): SkillPromptSection[] {
    return [
      {
        title: 'Mathematical Calculations',
        body: 'You have the ability to perform mathematical calculations.',
        bullets: [
          'Use the calculate tool to evaluate mathematical expressions.',
          'Supported operations: addition (+), subtraction (-), multiplication (*), division (/), exponentiation (^), and modulo (%).',
          'Parentheses can be used for grouping, e.g., (2 + 3) * 4.',
          'When a user asks you to compute something, use this tool rather than attempting mental math.',
        ],
      },
    ];
  }
}

/**
 * Factory function for creating MathSkill instances.
 */
export function createSkill(config?: SkillConfig): MathSkill {
  return new MathSkill(config);
}
