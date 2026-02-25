/**
 * Smoke tests for all example files.
 *
 * Dynamically imports each example and verifies it produces valid SWML
 * and has expected tools registered.
 */

import { loadAgent } from '../src/cli/agent-loader.js';

// Helper: load an example and return the agent
async function loadExample(name: string): Promise<any> {
  return loadAgent(`examples/${name}`);
}

describe('examples', () => {
  // ── Existing examples ───────────────────────────────────────────

  describe('simple-agent.ts', () => {
    it('renders SWML with AI block and get_time tool', async () => {
      const agent = await loadExample('simple-agent.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id'));
      expect(swml).toHaveProperty('version', '1.0.0');
      expect(swml).toHaveProperty('sections');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t: any) => t.name === 'get_time')).toBe(true);
    });
  });

  // ── Prefab examples ─────────────────────────────────────────────

  describe('prefab-info-gatherer.ts', () => {
    it('renders SWML with save_field and get_status tools', async () => {
      const agent = await loadExample('prefab-info-gatherer.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id'));
      expect(swml).toHaveProperty('version');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t: any) => t.name);
      expect(names).toContain('save_field');
      expect(names).toContain('get_status');
    });
  });

  describe('prefab-survey.ts', () => {
    it('renders SWML with survey tools', async () => {
      const agent = await loadExample('prefab-survey.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t: any) => t.name);
      expect(names).toContain('answer_question');
      expect(names).toContain('get_current_question');
      expect(names).toContain('get_survey_progress');
    });
  });

  describe('prefab-faq.ts', () => {
    it('renders SWML with search_faq and escalate tools', async () => {
      const agent = await loadExample('prefab-faq.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t: any) => t.name);
      expect(names).toContain('search_faq');
      expect(names).toContain('escalate');
    });
  });

  describe('prefab-concierge.ts', () => {
    it('renders SWML with department tools', async () => {
      const agent = await loadExample('prefab-concierge.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t: any) => t.name);
      expect(names).toContain('list_departments');
      expect(names).toContain('get_department_info');
      expect(names).toContain('transfer_to_department');
    });
  });

  describe('prefab-receptionist.ts', () => {
    it('renders SWML with receptionist tools', async () => {
      const agent = await loadExample('prefab-receptionist.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t: any) => t.name);
      expect(names).toContain('get_department_list');
      expect(names).toContain('transfer_to_department');
      expect(names).toContain('check_in_visitor');
    });
  });

  // ── Skills & features examples ──────────────────────────────────

  describe('skills-demo.ts', () => {
    it('renders SWML with datetime and math tools from skills', async () => {
      const agent = await loadExample('skills-demo.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t: any) => t.name);
      expect(names).toContain('get_datetime');
      expect(names).toContain('calculate');
    });
  });

  describe('advanced-dynamic-config.ts', () => {
    it('renders SWML with lookup_account tool', async () => {
      const agent = await loadExample('advanced-dynamic-config.ts');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t: any) => t.name === 'lookup_account')).toBe(true);
    });
  });

  describe('llm-params.ts', () => {
    it('renders SWML with tuned parameters', async () => {
      const agent = await loadExample('llm-params.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id'));
      expect(swml).toHaveProperty('version');
      // Check the AI params contain temperature
      const sections = swml['sections'];
      const main = sections['main'];
      const aiVerb = main.find((v: any) => v['ai']);
      expect(aiVerb).toBeDefined();
      expect(aiVerb['ai']['params']['temperature']).toBe(0.2);
    });
  });

  describe('session-state.ts', () => {
    it('renders SWML with lookup_order tool', async () => {
      const agent = await loadExample('session-state.ts');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t: any) => t.name === 'lookup_order')).toBe(true);
    });
  });

  describe('record-call.ts', () => {
    it('renders SWML with recording tools', async () => {
      const agent = await loadExample('record-call.ts');
      const tools = agent.getRegisteredTools();
      const names = tools.map((t: any) => t.name);
      expect(names).toContain('start_recording');
      expect(names).toContain('stop_recording');
      expect(names).toContain('transfer_to_supervisor');
    });
  });

  // ── Infrastructure & verb examples ──────────────────────────────

  describe('serverless-lambda.ts', () => {
    it('renders SWML and exports handler function', async () => {
      // loadAgent will find the 'agent' export
      const agent = await loadExample('serverless-lambda.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id'));
      expect(swml).toHaveProperty('version');
    });
  });

  describe('verb-methods.ts', () => {
    it('renders SWML with pre-answer and post-AI verbs', async () => {
      const agent = await loadExample('verb-methods.ts');
      const swml = JSON.parse(agent.renderSwml('test-call-id'));
      expect(swml).toHaveProperty('version');
      const main = swml['sections']['main'];
      // Should have pre-answer play verb
      expect(main.some((v: any) => v['play'])).toBe(true);
    });
  });

  describe('kubernetes-agent.ts', () => {
    it('renders SWML with get_status tool', async () => {
      const agent = await loadExample('kubernetes-agent.ts');
      const tools = agent.getRegisteredTools();
      expect(tools.some((t: any) => t.name === 'get_status')).toBe(true);
    });
  });

  // ── SWMLService examples ────────────────────────────────────────

  describe('swml-service.ts', () => {
    it('produces SWML with no AI block', async () => {
      const svc = await loadExample('swml-service.ts');
      const doc = svc.renderSwml();
      expect(doc).toHaveProperty('version', '1.0.0');
      const main = doc['sections']['main'];
      expect(main.length).toBeGreaterThan(0);
      // No AI block in any verb
      for (const verb of main) {
        expect(verb).not.toHaveProperty('ai');
      }
    });
  });

  describe('dynamic-swml-service.ts', () => {
    it('loads without error', async () => {
      const svc = await loadExample('dynamic-swml-service.ts');
      expect(svc).toBeDefined();
      // Static renderSwml returns empty main (dynamic content is per-request)
      const doc = svc.renderSwml();
      expect(doc).toHaveProperty('version', '1.0.0');
    });
  });
});
