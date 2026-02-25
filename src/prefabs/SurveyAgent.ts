/**
 * SurveyAgent - A prefab agent that conducts surveys with branching logic,
 * scoring, and conditional question flow.
 *
 * Supports multiple question types (multiple choice, open ended, rating,
 * yes/no), conditional branching based on answers, and per-answer scoring.
 */

import { AgentBase } from '../AgentBase.js';
import { SwaigFunctionResult } from '../SwaigFunctionResult.js';
import type { AgentOptions } from '../types.js';

// ── Config types ────────────────────────────────────────────────────────────

export interface SurveyQuestion {
  /** Unique question identifier. */
  id: string;
  /** The question text to ask the caller. */
  text: string;
  /** Question type determines validation and display. */
  type: 'multiple_choice' | 'open_ended' | 'rating' | 'yes_no';
  /** Options for multiple_choice questions. */
  options?: string[];
  /**
   * Next question ID after this one.
   * - string: always go to that question
   * - Record<string, string>: map from answer value to next question ID
   * - undefined: proceed to next question in array order
   */
  nextQuestion?: string | Record<string, string>;
  /**
   * Points awarded for answers.
   * - number: fixed points for any answer
   * - Record<string, number>: points per specific answer value
   */
  points?: number | Record<string, number>;
}

export interface SurveyConfig {
  /** Agent display name. */
  name?: string;
  /** Ordered list of survey questions. */
  questions: SurveyQuestion[];
  /** Opening message before the first question. */
  introMessage?: string;
  /** Message after the survey is complete. */
  completionMessage?: string;
  /** Callback fired when the survey is finished. */
  onComplete?: (responses: Record<string, unknown>, score: number) => void | Promise<void>;
  /** Additional AgentBase options forwarded to super(). */
  agentOptions?: Partial<AgentOptions>;
}

// ── Per-call session state ──────────────────────────────────────────────────

interface SurveySession {
  currentQuestionIndex: number;
  currentQuestionId: string;
  responses: Record<string, unknown>;
  score: number;
  completed: boolean;
}

// ── Agent ───────────────────────────────────────────────────────────────────

/** Prefab agent that conducts surveys with branching logic, answer scoring, and conditional question flow. */
export class SurveyAgent extends AgentBase {
  private questions: SurveyQuestion[];
  private questionMap: Map<string, SurveyQuestion>;
  private introMessage: string;
  private completionMessage: string;
  private onCompleteCallback?: (responses: Record<string, unknown>, score: number) => void | Promise<void>;
  private sessions: Map<string, SurveySession> = new Map();

  /** Declarative prompt sections merged by AgentBase constructor. */
  static override PROMPT_SECTIONS = [
    {
      title: 'Role',
      body: 'You are a friendly survey agent. Your job is to ask the caller a series of questions and record their answers accurately.',
    },
    {
      title: 'Rules',
      bullets: [
        'Always start by calling get_current_question to know which question to ask.',
        'Ask one question at a time.',
        'For multiple choice questions, read all available options to the caller.',
        'For rating questions, specify the scale (1-5 or 1-10 as appropriate).',
        'For yes/no questions, accept variations like "yeah", "nope", "sure", etc.',
        'After each answer, use answer_question to record the response.',
        'Use get_survey_progress to check how far along the survey is.',
        'Do not skip questions unless the branching logic directs you to.',
        'When the survey is complete, thank the caller for their time.',
      ],
    },
  ];

  /**
   * Create a SurveyAgent with the specified questions and callbacks.
   * @param config - Configuration including questions, messages, and completion callback.
   */
  constructor(config: SurveyConfig) {
    const agentName = config.name ?? 'SurveyAgent';
    super({
      name: agentName,
      ...config.agentOptions,
    });

    this.questions = config.questions;
    this.questionMap = new Map(config.questions.map((q) => [q.id, q]));
    this.introMessage = config.introMessage ?? 'Thank you for taking our survey. I have a few questions for you.';
    this.completionMessage = config.completionMessage ?? 'Thank you for completing the survey! Your responses have been recorded.';
    this.onCompleteCallback = config.onComplete;

    // Build questions overview for the prompt
    const questionBullets = this.questions.map((q) => {
      let desc = `[${q.id}] (${q.type}) ${q.text}`;
      if (q.options) desc += ` Options: ${q.options.join(', ')}`;
      return desc;
    });
    this.promptAddSection('Survey Questions', { bullets: questionBullets, numbered: true });

    this.promptAddSection('Introduction', {
      body: `Begin the conversation with: "${this.introMessage}"`,
    });

    // Register tools after all fields are initialized
    this.defineTools();
  }

  // ── Session helpers ───────────────────────────────────────────────────

  private getSession(rawData: Record<string, unknown>): SurveySession {
    const callId = (rawData['call_id'] as string) ?? 'default';
    let session = this.sessions.get(callId);
    if (!session) {
      const firstQuestion = this.questions[0];
      session = {
        currentQuestionIndex: 0,
        currentQuestionId: firstQuestion ? firstQuestion.id : '',
        responses: {},
        score: 0,
        completed: false,
      };
      this.sessions.set(callId, session);
    }
    return session;
  }

  private resolveNextQuestion(question: SurveyQuestion, answer: string): string | null {
    if (!question.nextQuestion) {
      // Default: find next in array order
      const idx = this.questions.findIndex((q) => q.id === question.id);
      if (idx >= 0 && idx < this.questions.length - 1) {
        return this.questions[idx + 1].id;
      }
      return null; // end of survey
    }

    if (typeof question.nextQuestion === 'string') {
      return question.nextQuestion;
    }

    // Conditional branching: try exact match first, then case-insensitive
    const normalizedAnswer = answer.toLowerCase().trim();
    for (const [key, nextId] of Object.entries(question.nextQuestion)) {
      if (key.toLowerCase().trim() === normalizedAnswer) {
        return nextId;
      }
    }

    // If no branch matches, try default key or fall through to next in order
    if ('_default' in question.nextQuestion) {
      return question.nextQuestion['_default'];
    }

    const idx = this.questions.findIndex((q) => q.id === question.id);
    if (idx >= 0 && idx < this.questions.length - 1) {
      return this.questions[idx + 1].id;
    }
    return null;
  }

  private calculatePoints(question: SurveyQuestion, answer: string): number {
    if (question.points === undefined) return 0;
    if (typeof question.points === 'number') return question.points;

    // Per-answer scoring
    const normalizedAnswer = answer.toLowerCase().trim();
    for (const [key, pts] of Object.entries(question.points)) {
      if (key.toLowerCase().trim() === normalizedAnswer) {
        return pts;
      }
    }
    return 0;
  }

  private validateAnswer(question: SurveyQuestion, answer: string): string | null {
    switch (question.type) {
      case 'multiple_choice': {
        if (!question.options || question.options.length === 0) return null;
        const normalized = answer.toLowerCase().trim();
        const match = question.options.find((o) => o.toLowerCase().trim() === normalized);
        if (!match) {
          return `Invalid answer. Please choose one of: ${question.options.join(', ')}`;
        }
        return null;
      }
      case 'rating': {
        const num = parseInt(answer, 10);
        if (isNaN(num) || num < 1 || num > 10) {
          return 'Please provide a rating between 1 and 10.';
        }
        return null;
      }
      case 'yes_no': {
        const normalized = answer.toLowerCase().trim();
        const yesValues = ['yes', 'y', 'yeah', 'yep', 'sure', 'absolutely', 'correct', 'true'];
        const noValues = ['no', 'n', 'nah', 'nope', 'negative', 'false'];
        if (!yesValues.includes(normalized) && !noValues.includes(normalized)) {
          return 'Please answer with yes or no.';
        }
        return null;
      }
      case 'open_ended':
        return null; // Accept anything
      default:
        return null;
    }
  }

  private normalizeAnswer(question: SurveyQuestion, answer: string): string {
    if (question.type === 'yes_no') {
      const normalized = answer.toLowerCase().trim();
      const yesValues = ['yes', 'y', 'yeah', 'yep', 'sure', 'absolutely', 'correct', 'true'];
      return yesValues.includes(normalized) ? 'yes' : 'no';
    }
    return answer;
  }

  // ── Tool registration ─────────────────────────────────────────────────

  /** Register the answer_question, get_current_question, and get_survey_progress SWAIG tools. */
  protected override defineTools(): void {
    // Tool: answer_question
    this.defineTool({
      name: 'answer_question',
      description: 'Record the caller\'s answer to the current survey question. Validates the answer based on question type and advances to the next question.',
      parameters: {
        type: 'object',
        properties: {
          question_id: {
            type: 'string',
            description: 'The ID of the question being answered.',
          },
          answer: {
            type: 'string',
            description: 'The caller\'s answer to the question.',
          },
        },
        required: ['question_id', 'answer'],
      },
      handler: async (args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const questionId = args['question_id'] as string;
        const answer = args['answer'] as string;

        if (!questionId || !answer) {
          return new SwaigFunctionResult('Both question_id and answer are required.');
        }

        const question = this.questionMap.get(questionId);
        if (!question) {
          return new SwaigFunctionResult(`Unknown question ID "${questionId}".`);
        }

        const session = this.getSession(rawData);

        if (session.completed) {
          return new SwaigFunctionResult('The survey has already been completed.');
        }

        // Validate the answer
        const validationError = this.validateAnswer(question, answer);
        if (validationError) {
          return new SwaigFunctionResult(validationError);
        }

        // Normalize and save
        const normalizedAnswer = this.normalizeAnswer(question, answer);
        session.responses[questionId] = normalizedAnswer;

        // Calculate and add points
        const points = this.calculatePoints(question, normalizedAnswer);
        session.score += points;

        // Determine next question
        const nextId = this.resolveNextQuestion(question, normalizedAnswer);

        if (!nextId || !this.questionMap.has(nextId)) {
          // Survey complete
          session.completed = true;
          if (this.onCompleteCallback) {
            try {
              await this.onCompleteCallback({ ...session.responses }, session.score);
            } catch (err) {
              this.log.error(`onComplete callback error: ${err}`);
            }
          }
          const answeredCount = Object.keys(session.responses).length;
          return new SwaigFunctionResult(
            `Answer recorded. The survey is now complete! ${answeredCount} questions answered, total score: ${session.score}. ${this.completionMessage}`,
          );
        }

        // Advance to next question
        session.currentQuestionId = nextId;
        const nextQ = this.questionMap.get(nextId)!;
        const nextIdx = this.questions.findIndex((q) => q.id === nextId);
        if (nextIdx >= 0) session.currentQuestionIndex = nextIdx;

        let nextInfo = `Answer recorded. Next question [${nextQ.id}]: "${nextQ.text}"`;
        if (nextQ.type === 'multiple_choice' && nextQ.options) {
          nextInfo += ` (Options: ${nextQ.options.join(', ')})`;
        } else if (nextQ.type === 'rating') {
          nextInfo += ' (Rating: 1-10)';
        } else if (nextQ.type === 'yes_no') {
          nextInfo += ' (Yes/No)';
        }

        return new SwaigFunctionResult(nextInfo);
      },
    });

    // Tool: get_current_question
    this.defineTool({
      name: 'get_current_question',
      description: 'Get the current question that should be asked to the caller.',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const session = this.getSession(rawData);

        if (session.completed) {
          return new SwaigFunctionResult('The survey has been completed. No more questions.');
        }

        const question = this.questionMap.get(session.currentQuestionId);
        if (!question) {
          return new SwaigFunctionResult('No current question available.');
        }

        let info = `Current question [${question.id}] (${question.type}): "${question.text}"`;
        if (question.type === 'multiple_choice' && question.options) {
          info += ` Options: ${question.options.join(', ')}`;
        } else if (question.type === 'rating') {
          info += ' (Caller should provide a rating from 1 to 10)';
        } else if (question.type === 'yes_no') {
          info += ' (Caller should answer yes or no)';
        }

        return new SwaigFunctionResult(info);
      },
    });

    // Tool: get_survey_progress
    this.defineTool({
      name: 'get_survey_progress',
      description: 'Get the current progress of the survey, including how many questions have been answered and the current score.',
      parameters: {
        type: 'object',
        properties: {},
      },
      handler: (_args: Record<string, unknown>, rawData: Record<string, unknown>) => {
        const session = this.getSession(rawData);
        const answeredCount = Object.keys(session.responses).length;
        const totalCount = this.questions.length;
        const percentage = totalCount > 0 ? Math.round((answeredCount / totalCount) * 100) : 0;

        let progress = `Survey progress: ${answeredCount}/${totalCount} questions answered (${percentage}%). Current score: ${session.score}.`;

        if (session.completed) {
          progress += ' Survey is COMPLETE.';
        } else {
          progress += ` Current question: ${session.currentQuestionId}.`;
        }

        // List answered questions
        if (answeredCount > 0) {
          const answered = Object.entries(session.responses)
            .map(([qId, ans]) => `${qId}: ${ans}`)
            .join('; ');
          progress += ` Answers so far: ${answered}`;
        }

        return new SwaigFunctionResult(progress);
      },
    });
  }
}

// ── Factory function ────────────────────────────────────────────────────────

/**
 * Factory function that creates and returns a new SurveyAgent.
 * @param config - Configuration for the survey agent.
 * @returns A configured SurveyAgent instance.
 */
export function createSurveyAgent(config: SurveyConfig): SurveyAgent {
  return new SurveyAgent(config);
}

export default SurveyAgent;
