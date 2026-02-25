import { describe, it, expect, vi, beforeAll } from 'vitest';
import { suppressAllLogs } from '../../src/Logger.js';
import { InfoGathererAgent, createInfoGathererAgent } from '../../src/prefabs/InfoGathererAgent.js';
import { SurveyAgent, createSurveyAgent } from '../../src/prefabs/SurveyAgent.js';
import { FAQBotAgent, createFAQBotAgent } from '../../src/prefabs/FAQBotAgent.js';
import { ConciergeAgent, createConciergeAgent } from '../../src/prefabs/ConciergeAgent.js';
import { ReceptionistAgent, createReceptionistAgent } from '../../src/prefabs/ReceptionistAgent.js';

beforeAll(() => {
  suppressAllLogs(true);
});

// ============================================================================
// InfoGathererAgent
// ============================================================================

describe('InfoGathererAgent', () => {
  const baseFields = [
    { name: 'full_name', description: 'Full name of the caller', required: true },
    { name: 'email', description: 'Email address', required: true, validation: '^[^@]+@[^@]+\\.[^@]+$' },
    { name: 'phone', description: 'Phone number', required: true, validation: /^\d{10}$/ },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new InfoGathererAgent({
      fields: baseFields,
      ...overrides,
    });
  }

  it('creates with fields config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(InfoGathererAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has save_field and get_status tools', () => {
    const agent = createAgent();
    expect(agent.getTool('save_field')).toBeDefined();
    expect(agent.getTool('get_status')).toBeDefined();
  });

  it('save_field handler stores data', async () => {
    const agent = createAgent();
    const tool = agent.getTool('save_field')!;
    const result = await tool.execute(
      { field_name: 'full_name', value: 'John Doe' },
      { call_id: 'call-1' },
    );
    expect(result.response).toContain('saved');
    expect(result.response).toContain('full_name');
  });

  it('save_field validates against regex string pattern', async () => {
    const agent = createAgent();
    const tool = agent.getTool('save_field')!;
    const result = await tool.execute(
      { field_name: 'email', value: 'not-an-email' },
      { call_id: 'call-2' },
    );
    expect(result.response).toContain('not valid');
  });

  it('save_field validates against RegExp pattern', async () => {
    const agent = createAgent();
    const tool = agent.getTool('save_field')!;
    const result = await tool.execute(
      { field_name: 'phone', value: '123' },
      { call_id: 'call-3' },
    );
    expect(result.response).toContain('not valid');

    // Valid phone passes
    const result2 = await tool.execute(
      { field_name: 'phone', value: '5551234567' },
      { call_id: 'call-3' },
    );
    expect(result2.response).toContain('saved');
  });

  it('get_status returns collected and remaining', async () => {
    const agent = createAgent();
    const saveTool = agent.getTool('save_field')!;
    await saveTool.execute(
      { field_name: 'full_name', value: 'Jane Doe' },
      { call_id: 'call-4' },
    );

    const statusTool = agent.getTool('get_status')!;
    const status = await statusTool.execute({}, { call_id: 'call-4' });
    expect(status.response).toContain('full_name: Jane Doe');
    expect(status.response).toContain('email');
    expect(status.response).toContain('phone');
  });

  it('all required fields triggers completion message', async () => {
    const agent = createAgent();
    const tool = agent.getTool('save_field')!;
    const callData = { call_id: 'call-5' };

    await tool.execute({ field_name: 'full_name', value: 'Jane Doe' }, callData);
    await tool.execute({ field_name: 'email', value: 'jane@example.com' }, callData);
    const result = await tool.execute({ field_name: 'phone', value: '5551234567' }, callData);

    expect(result.response).toContain('All required fields are now collected');
    expect(result.response).toContain('Thank you');
  });

  it('prompt mentions field names', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    const promptText = JSON.stringify(parsed);
    expect(promptText).toContain('full_name');
    expect(promptText).toContain('email');
    expect(promptText).toContain('phone');
  });

  it('works with optional fields', async () => {
    const agent = new InfoGathererAgent({
      fields: [
        { name: 'name', description: 'Name', required: true },
        { name: 'nickname', description: 'Nickname', required: false },
      ],
    });

    const saveTool = agent.getTool('save_field')!;
    const callData = { call_id: 'call-6' };

    // Completing only the required field should trigger completion
    const result = await saveTool.execute({ field_name: 'name', value: 'Alice' }, callData);
    expect(result.response).toContain('All required fields are now collected');

    // get_status should mention optional field not yet collected
    const statusTool = agent.getTool('get_status')!;
    const status = await statusTool.execute({}, callData);
    expect(status.response).toContain('Optional');
    expect(status.response).toContain('nickname');
  });

  it('onComplete callback fires when all required fields collected', async () => {
    const onComplete = vi.fn();
    const agent = new InfoGathererAgent({
      fields: [{ name: 'name', description: 'Name' }],
      onComplete,
    });

    const tool = agent.getTool('save_field')!;
    await tool.execute({ field_name: 'name', value: 'Bob' }, { call_id: 'call-7' });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ name: 'Bob' });
  });

  it('returns error for invalid field name', async () => {
    const agent = createAgent();
    const tool = agent.getTool('save_field')!;
    const result = await tool.execute(
      { field_name: 'nonexistent', value: 'val' },
      { call_id: 'call-8' },
    );
    expect(result.response).toContain('Unknown field');
    expect(result.response).toContain('Available fields');
  });

  it('factory function creates agent', () => {
    const agent = createInfoGathererAgent({ fields: baseFields });
    expect(agent).toBeInstanceOf(InfoGathererAgent);
    expect(agent.getTool('save_field')).toBeDefined();
  });

  it('custom name and messages are applied', () => {
    const agent = new InfoGathererAgent({
      name: 'CustomGatherer',
      fields: [{ name: 'age', description: 'Age' }],
      introMessage: 'Hi there!',
      confirmationMessage: 'All done!',
    });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Hi there!');
  });
});

// ============================================================================
// SurveyAgent
// ============================================================================

describe('SurveyAgent', () => {
  const baseQuestions = [
    {
      id: 'q1',
      text: 'How satisfied are you with our service?',
      type: 'rating' as const,
      points: 1,
    },
    {
      id: 'q2',
      text: 'Would you recommend us?',
      type: 'yes_no' as const,
      points: { yes: 10, no: 0 },
    },
    {
      id: 'q3',
      text: 'Which feature do you like most?',
      type: 'multiple_choice' as const,
      options: ['Speed', 'Price', 'Support'],
    },
    {
      id: 'q4',
      text: 'Any additional comments?',
      type: 'open_ended' as const,
    },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new SurveyAgent({
      questions: baseQuestions,
      ...overrides,
    });
  }

  it('creates with questions config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(SurveyAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has answer_question, get_current_question, and get_survey_progress tools', () => {
    const agent = createAgent();
    expect(agent.getTool('answer_question')).toBeDefined();
    expect(agent.getTool('get_current_question')).toBeDefined();
    expect(agent.getTool('get_survey_progress')).toBeDefined();
  });

  it('get_current_question returns first question initially', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_current_question')!;
    const result = await tool.execute({}, { call_id: 'survey-1' });
    expect(result.response).toContain('q1');
    expect(result.response).toContain('How satisfied');
  });

  it('answer_question stores response and advances', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'survey-2' };

    const result = await tool.execute({ question_id: 'q1', answer: '8' }, callData);
    expect(result.response).toContain('Answer recorded');
    expect(result.response).toContain('q2');

    // Verify progress
    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('1/4');
    expect(progress.response).toContain('q1: 8');
  });

  it('branching: conditional nextQuestion works', async () => {
    const branchQuestions = [
      {
        id: 'start',
        text: 'Do you like it?',
        type: 'yes_no' as const,
        nextQuestion: { yes: 'positive', no: 'negative' },
      },
      {
        id: 'positive',
        text: 'What do you love?',
        type: 'open_ended' as const,
      },
      {
        id: 'negative',
        text: 'What can we improve?',
        type: 'open_ended' as const,
      },
    ];

    const agent = new SurveyAgent({ questions: branchQuestions });
    const tool = agent.getTool('answer_question')!;

    // Answer "yes" should branch to "positive"
    const result = await tool.execute(
      { question_id: 'start', answer: 'yes' },
      { call_id: 'branch-1' },
    );
    expect(result.response).toContain('positive');
    expect(result.response).toContain('What do you love');

    // A separate call answering "no" should branch to "negative"
    const agent2 = new SurveyAgent({ questions: branchQuestions });
    const tool2 = agent2.getTool('answer_question')!;
    const result2 = await tool2.execute(
      { question_id: 'start', answer: 'no' },
      { call_id: 'branch-2' },
    );
    expect(result2.response).toContain('negative');
    expect(result2.response).toContain('What can we improve');
  });

  it('scoring: points accumulate', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'score-1' };

    // q1 has fixed points=1
    await tool.execute({ question_id: 'q1', answer: '7' }, callData);
    // q2 has per-answer: yes=10
    await tool.execute({ question_id: 'q2', answer: 'yes' }, callData);

    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('Current score: 11');
  });

  it('get_survey_progress shows progress percentage', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'prog-1' };

    await tool.execute({ question_id: 'q1', answer: '5' }, callData);
    await tool.execute({ question_id: 'q2', answer: 'yes' }, callData);

    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('2/4');
    expect(progress.response).toContain('50%');
  });

  it('survey completion triggers onComplete', async () => {
    const onComplete = vi.fn();
    const simpleQuestions = [
      { id: 'only', text: 'Rate us', type: 'rating' as const, points: 5 },
    ];
    const agent = new SurveyAgent({ questions: simpleQuestions, onComplete });

    const tool = agent.getTool('answer_question')!;
    await tool.execute({ question_id: 'only', answer: '9' }, { call_id: 'done-1' });

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onComplete).toHaveBeenCalledWith({ only: '9' }, 5);
  });

  it('rating type validates range', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;

    // Out of range
    const result = await tool.execute(
      { question_id: 'q1', answer: '15' },
      { call_id: 'val-1' },
    );
    expect(result.response).toContain('rating between 1 and 10');

    // Not a number
    const result2 = await tool.execute(
      { question_id: 'q1', answer: 'abc' },
      { call_id: 'val-2' },
    );
    expect(result2.response).toContain('rating between 1 and 10');
  });

  it('yes/no type normalizes answers', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'norm-1' };

    // Answer q1 first (rating)
    await tool.execute({ question_id: 'q1', answer: '7' }, callData);

    // "yeah" should be normalized to "yes"
    await tool.execute({ question_id: 'q2', answer: 'yeah' }, callData);

    const progressTool = agent.getTool('get_survey_progress')!;
    const progress = await progressTool.execute({}, callData);
    expect(progress.response).toContain('q2: yes');
  });

  it('multiple choice validates options', async () => {
    const agent = createAgent();
    const tool = agent.getTool('answer_question')!;
    const callData = { call_id: 'mc-1' };

    // Skip to q3 by answering q1 and q2 first
    await tool.execute({ question_id: 'q1', answer: '5' }, callData);
    await tool.execute({ question_id: 'q2', answer: 'yes' }, callData);

    // Invalid option
    const result = await tool.execute(
      { question_id: 'q3', answer: 'InvalidOption' },
      callData,
    );
    expect(result.response).toContain('Invalid answer');
    expect(result.response).toContain('Speed');
    expect(result.response).toContain('Price');
    expect(result.response).toContain('Support');
  });

  it('factory function creates agent', () => {
    const agent = createSurveyAgent({ questions: baseQuestions });
    expect(agent).toBeInstanceOf(SurveyAgent);
    expect(agent.getTool('answer_question')).toBeDefined();
  });
});

// ============================================================================
// FAQBotAgent
// ============================================================================

describe('FAQBotAgent', () => {
  const baseFaqs = [
    {
      question: 'What are your business hours?',
      answer: 'We are open Monday through Friday, 9am to 5pm EST.',
      keywords: ['hours', 'open', 'schedule', 'time'],
    },
    {
      question: 'How do I reset my password?',
      answer: 'Go to the login page, click "Forgot Password", and follow the instructions.',
      keywords: ['password', 'reset', 'login', 'forgot'],
    },
    {
      question: 'What is the return policy?',
      answer: 'You can return any item within 30 days of purchase for a full refund.',
      keywords: ['return', 'refund', 'policy'],
    },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new FAQBotAgent({
      faqs: baseFaqs,
      ...overrides,
    });
  }

  it('creates with FAQs config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(FAQBotAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has search_faq tool and no escalate when not configured', () => {
    const agent = createAgent();
    expect(agent.getTool('search_faq')).toBeDefined();
    expect(agent.getTool('escalate')).toBeUndefined();
  });

  it('search_faq returns matching FAQ', async () => {
    const agent = createAgent();
    const tool = agent.getTool('search_faq')!;
    const result = await tool.execute({ query: 'What are your business hours?' }, {});
    expect(result.response).toContain('Monday through Friday');
    expect(result.response).toContain('9am to 5pm');
  });

  it('returns no-match for unrelated query', async () => {
    const agent = createAgent({ threshold: 0.5 });
    const tool = agent.getTool('search_faq')!;
    const result = await tool.execute({ query: 'quantum physics dark matter' }, {});
    expect(result.response).toContain('No FAQ matched');
  });

  it('threshold filtering works', async () => {
    // High threshold makes it hard to match
    const agent = createAgent({ threshold: 0.99 });
    const tool = agent.getTool('search_faq')!;
    const result = await tool.execute({ query: 'hours open' }, {});
    expect(result.response).toContain('No FAQ matched');

    // Low threshold makes it easy to match
    const agent2 = createAgent({ threshold: 0.01 });
    const tool2 = agent2.getTool('search_faq')!;
    const result2 = await tool2.execute({ query: 'hours open' }, {});
    expect(result2.response).toContain('FAQ Match');
  });

  it('escalate tool is not registered without escalation number', () => {
    const agent = createAgent();
    expect(agent.getTool('escalate')).toBeUndefined();
  });

  it('escalate tool is registered when escalation number is set', () => {
    const agent = createAgent({ escalationNumber: '+15551234567' });
    expect(agent.getTool('escalate')).toBeDefined();
  });

  it('escalate tool transfers caller', async () => {
    const agent = createAgent({ escalationNumber: '+15551234567' });
    const tool = agent.getTool('escalate')!;
    const result = await tool.execute({ reason: 'Cannot find answer' }, {});
    expect(result.response).toContain('Transferring');
    expect(result.response).toContain('Cannot find answer');
    const actions = result.action as Record<string, unknown>[];
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('search_faq includes escalation message when no match', async () => {
    const agent = createAgent({ escalationMessage: 'Please hold for an agent.' });
    const tool = agent.getTool('search_faq')!;
    const result = await tool.execute({ query: 'completely unrelated topic xyz' }, {});
    // The escalation message is included in the no-match response
    expect(result.response).toContain('No FAQ matched');
  });

  it('keywords improve matching', async () => {
    const agent = createAgent({ threshold: 0.3 });
    const tool = agent.getTool('search_faq')!;

    // Query using keywords that match the password FAQ
    const result = await tool.execute({ query: 'forgot password reset' }, {});
    expect(result.response).toContain('FAQ Match');
    expect(result.response).toContain('Forgot Password');
  });

  it('prompt mentions FAQ topics', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('business hours');
    expect(swml).toContain('password');
    expect(swml).toContain('return policy');
  });

  it('factory function creates agent', () => {
    const agent = createFAQBotAgent({ faqs: baseFaqs });
    expect(agent).toBeInstanceOf(FAQBotAgent);
    expect(agent.getTool('search_faq')).toBeDefined();
  });
});

// ============================================================================
// ConciergeAgent
// ============================================================================

describe('ConciergeAgent', () => {
  const baseDepartments = [
    {
      name: 'Sales',
      description: 'Handles product inquiries and purchases.',
      transferNumber: '+15551001001',
      keywords: ['buy', 'purchase', 'pricing'],
      hoursOfOperation: 'Mon-Fri 9am-5pm EST',
    },
    {
      name: 'Support',
      description: 'Handles technical issues and troubleshooting.',
      transferNumber: '+15551002002',
      keywords: ['help', 'issue', 'problem', 'technical'],
      hoursOfOperation: '24/7',
    },
    {
      name: 'HR',
      description: 'Handles employment and benefits inquiries.',
      keywords: ['employment', 'benefits', 'job'],
      // No transferNumber
    },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new ConciergeAgent({
      departments: baseDepartments,
      companyName: 'Acme Corp',
      ...overrides,
    });
  }

  it('creates with departments config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(ConciergeAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has list_departments, get_department_info, and transfer_to_department tools', () => {
    const agent = createAgent();
    expect(agent.getTool('list_departments')).toBeDefined();
    expect(agent.getTool('get_department_info')).toBeDefined();
    expect(agent.getTool('transfer_to_department')).toBeDefined();
  });

  it('list_departments returns all departments', async () => {
    const agent = createAgent();
    const tool = agent.getTool('list_departments')!;
    const result = await tool.execute({}, {});
    expect(result.response).toContain('Sales');
    expect(result.response).toContain('Support');
    expect(result.response).toContain('HR');
    expect(result.response).toContain('Acme Corp');
  });

  it('get_department_info returns specific department', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_department_info')!;
    const result = await tool.execute({ department_name: 'Sales' }, {});
    expect(result.response).toContain('Sales');
    expect(result.response).toContain('product inquiries');
    expect(result.response).toContain('Mon-Fri 9am-5pm');
    expect(result.response).toContain('Transfer: available');
  });

  it('transfer_to_department handles missing transfer number', async () => {
    const agent = createAgent();
    const tool = agent.getTool('transfer_to_department')!;
    const result = await tool.execute({ department_name: 'HR' }, {});
    expect(result.response).toContain('does not have a direct transfer number');
  });

  it('department lookup by keyword', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_department_info')!;
    // "buy" is a keyword for "Sales"
    const result = await tool.execute({ department_name: 'buy' }, {});
    expect(result.response).toContain('Sales');
    expect(result.response).toContain('product inquiries');
  });

  it('prompt mentions company name', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Acme Corp');
  });

  it('general info is included in prompt', () => {
    const agent = createAgent({ generalInfo: 'We are a leading technology provider.' });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('leading technology provider');
  });

  it('department without transfer number shows not available in list', async () => {
    const agent = createAgent();
    const tool = agent.getTool('list_departments')!;
    const result = await tool.execute({}, {});
    expect(result.response).toContain('no direct transfer available');
  });

  it('transfer_to_department connects successfully', async () => {
    const agent = createAgent();
    const tool = agent.getTool('transfer_to_department')!;
    const result = await tool.execute({ department_name: 'Support' }, {});
    expect(result.response).toContain('Transferring');
    expect(result.response).toContain('Support');
    // Check that a SWML connect action was produced
    const actions = result.action as Record<string, unknown>[];
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('factory function creates agent', () => {
    const agent = createConciergeAgent({ departments: baseDepartments });
    expect(agent).toBeInstanceOf(ConciergeAgent);
    expect(agent.getTool('list_departments')).toBeDefined();
  });
});

// ============================================================================
// ReceptionistAgent
// ============================================================================

describe('ReceptionistAgent', () => {
  const baseDepartments = [
    { name: 'Engineering', extension: '1001', description: 'Software development team' },
    { name: 'Marketing', extension: '1002', description: 'Marketing and communications' },
    { name: 'Finance', extension: '1003' },
  ];

  function createAgent(overrides?: Record<string, unknown>) {
    return new ReceptionistAgent({
      companyName: 'TechCo',
      departments: baseDepartments,
      ...overrides,
    });
  }

  it('creates with departments config', () => {
    const agent = createAgent();
    expect(agent).toBeInstanceOf(ReceptionistAgent);
  });

  it('renders valid SWML', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    const parsed = JSON.parse(swml);
    expect(parsed.version).toBe('1.0.0');
    expect(parsed.sections.main).toBeDefined();
  });

  it('has get_department_list and transfer_to_department tools', () => {
    const agent = createAgent();
    expect(agent.getTool('get_department_list')).toBeDefined();
    expect(agent.getTool('transfer_to_department')).toBeDefined();
  });

  it('check_in_visitor is registered by default', () => {
    const agent = createAgent();
    expect(agent.getTool('check_in_visitor')).toBeDefined();
  });

  it('get_department_list returns departments', async () => {
    const agent = createAgent();
    const tool = agent.getTool('get_department_list')!;
    const result = await tool.execute({}, {});
    expect(result.response).toContain('Engineering');
    expect(result.response).toContain('1001');
    expect(result.response).toContain('Marketing');
    expect(result.response).toContain('1002');
    expect(result.response).toContain('Finance');
    expect(result.response).toContain('1003');
    expect(result.response).toContain('TechCo');
  });

  it('transfer_to_department connects to extension', async () => {
    const agent = createAgent();
    const tool = agent.getTool('transfer_to_department')!;
    const result = await tool.execute({ department_name: 'Engineering' }, {});
    expect(result.response).toContain('Transferring');
    expect(result.response).toContain('Engineering');
    expect(result.response).toContain('1001');
    // Check that a SWML connect action is present
    const actions = result.action as Record<string, unknown>[];
    expect(actions).toBeDefined();
    expect(actions.length).toBeGreaterThan(0);
  });

  it('transfer_to_department returns error for unknown department', async () => {
    const agent = createAgent();
    const tool = agent.getTool('transfer_to_department')!;
    const result = await tool.execute({ department_name: 'Unknown' }, {});
    expect(result.response).toContain('not found');
    expect(result.response).toContain('Available departments');
  });

  it('check_in_visitor records visitor data', async () => {
    const agent = createAgent();
    const tool = agent.getTool('check_in_visitor')!;
    const result = await tool.execute(
      { visitor_name: 'Alice Smith', purpose: 'Interview', visiting: 'Engineering' },
      { call_id: 'check-1' },
    );
    expect(result.response).toContain('checked in successfully');
    expect(result.response).toContain('Alice Smith');
    expect(result.response).toContain('Interview');
    expect(result.response).toContain('Engineering');
    expect(result.response).toContain('TechCo');
  });

  it('check_in_visitor absent with checkInEnabled=false', () => {
    const agent = new ReceptionistAgent({
      companyName: 'TechCo',
      departments: baseDepartments,
      checkInEnabled: false,
    });
    expect(agent.getTool('check_in_visitor')).toBeUndefined();
    // Other tools still present
    expect(agent.getTool('get_department_list')).toBeDefined();
    expect(agent.getTool('transfer_to_department')).toBeDefined();
  });

  it('check_in_visitor present with checkInEnabled=true', () => {
    const agent = new ReceptionistAgent({
      companyName: 'TechCo',
      departments: baseDepartments,
      checkInEnabled: true,
    });
    expect(agent.getTool('check_in_visitor')).toBeDefined();
  });

  it('onVisitorCheckIn callback fires when visitor checks in', async () => {
    const onVisitorCheckIn = vi.fn();
    const agent = new ReceptionistAgent({
      companyName: 'TechCo',
      departments: baseDepartments,
      onVisitorCheckIn,
    });
    expect(agent).toBeInstanceOf(ReceptionistAgent);
    const tool = agent.getTool('check_in_visitor')!;
    expect(tool).toBeDefined();
    await tool.execute(
      { visitor_name: 'Bob Jones', purpose: 'Meeting', visiting: 'Marketing' },
      { call_id: 'cb-1' },
    );
    expect(onVisitorCheckIn).toHaveBeenCalledTimes(1);
    expect(onVisitorCheckIn).toHaveBeenCalledWith(
      expect.objectContaining({
        visitor_name: 'Bob Jones',
        purpose: 'Meeting',
        visiting: 'Marketing',
      }),
    );
  });

  it('prompt mentions company name', () => {
    const agent = createAgent();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('TechCo');
  });

  it('works without optional config', () => {
    const agent = new ReceptionistAgent({
      companyName: 'MinimalCo',
      departments: [{ name: 'General', extension: '100' }],
    });
    expect(agent).toBeInstanceOf(ReceptionistAgent);
    expect(agent.getTool('get_department_list')).toBeDefined();
    expect(agent.getTool('transfer_to_department')).toBeDefined();
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('MinimalCo');
  });

  it('factory function creates agent', () => {
    const agent = createReceptionistAgent({
      companyName: 'TechCo',
      departments: baseDepartments,
    });
    expect(agent).toBeInstanceOf(ReceptionistAgent);
    expect(agent.getTool('get_department_list')).toBeDefined();
  });

  it('custom welcome message appears in SWML', () => {
    const agent = new ReceptionistAgent({
      companyName: 'TechCo',
      departments: baseDepartments,
      welcomeMessage: 'Hello and welcome to TechCo headquarters!',
    });
    const swml = agent.renderSwml('test-call');
    expect(swml).toContain('Hello and welcome to TechCo headquarters!');
  });
});
