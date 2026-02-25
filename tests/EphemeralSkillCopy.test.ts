import { describe, it, expect } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';
import { SkillBase, type SkillManifest, type SkillToolDefinition, type SkillConfig } from '../src/skills/SkillBase.js';
import { SwaigFunctionResult } from '../src/SwaigFunctionResult.js';

/** Test skill that adds a tool and prompt section. */
class EphemeralTestSkill extends SkillBase {
  constructor(config?: SkillConfig) {
    super('ephemeral_test', config);
  }
  getManifest(): SkillManifest {
    return { name: 'ephemeral_test', description: 'Ephemeral test', version: '1.0.0' };
  }
  getTools(): SkillToolDefinition[] {
    return [{
      name: 'ephemeral_tool',
      description: 'A tool from ephemeral test skill',
      handler: () => new SwaigFunctionResult('ephemeral result'),
    }];
  }
  protected override _getPromptSections() {
    return [{ title: 'Ephemeral Section', body: 'ephemeral body' }];
  }
}

describe('Ephemeral Skill Copy', () => {
  it('ephemeral copy has same skill tools registered', async () => {
    const agent = new AgentBase({
      name: 'eph-agent',
      route: '/',
      basicAuth: ['user', 'pass'],
    });
    agent.setPromptText('You are a test assistant.');

    await agent.addSkill(new EphemeralTestSkill());

    // Verify original has the tool
    const tools = agent.getRegisteredTools();
    expect(tools.some(t => t.name === 'ephemeral_tool')).toBe(true);

    // Render SWML with dynamic config callback to test ephemeral copy
    let ephemeralToolNames: string[] = [];
    agent.setDynamicConfigCallback((_qp, _body, _headers, copy) => {
      ephemeralToolNames = copy.getRegisteredTools().map(t => t.name);
    });

    // Trigger SWML rendering via getApp()
    const app = agent.getApp();
    const response = await app.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('user:pass').toString('base64'),
      },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(200);
    expect(ephemeralToolNames).toContain('ephemeral_tool');
  });

  it('ephemeral copy renders SWML with skill tools', async () => {
    const agent = new AgentBase({
      name: 'eph-agent2',
      route: '/',
      basicAuth: ['user', 'pass'],
    });
    agent.setPromptText('You are a test assistant.');
    await agent.addSkill(new EphemeralTestSkill());

    let ephemeralSwml = '';
    agent.setDynamicConfigCallback((_qp, _body, _headers, copy) => {
      ephemeralSwml = copy.renderSwml();
    });

    const app = agent.getApp();
    await app.request('/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': 'Basic ' + Buffer.from('user:pass').toString('base64'),
      },
      body: JSON.stringify({}),
    });

    expect(ephemeralSwml).toBeTruthy();
    const parsed = JSON.parse(ephemeralSwml);
    const aiBlock = parsed.sections.main.find((v: any) => v.ai);
    expect(aiBlock).toBeDefined();
    const funcs = aiBlock.ai.SWAIG?.functions ?? [];
    expect(funcs.some((f: any) => f.function === 'ephemeral_tool')).toBe(true);
  });

  it('swaigFields are merged into tool definitions', async () => {
    const agent = new AgentBase({
      name: 'sf-agent',
      route: '/',
      basicAuth: ['user', 'pass'],
    });
    agent.setPromptText('Test');
    await agent.addSkill(new EphemeralTestSkill({ swaig_fields: { wait_file: 'hold.mp3' } }));

    const swml = JSON.parse(agent.renderSwml());
    const aiBlock = swml.sections.main.find((v: any) => v.ai);
    const funcs = aiBlock.ai.SWAIG.functions;
    const ephTool = funcs.find((f: any) => f.function === 'ephemeral_tool');
    expect(ephTool).toBeDefined();
    expect(ephTool.wait_file).toBe('hold.mp3');
  });
});
