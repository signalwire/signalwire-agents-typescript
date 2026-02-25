import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { AgentBase } from '../src/AgentBase.js';

describe('ProxyDetection', () => {
  let agent: AgentBase;

  beforeEach(() => {
    // Clear env vars that could interfere
    delete process.env['SWML_PROXY_URL_BASE'];
    delete process.env['SWML_PROXY_DEBUG'];
    // Enable proxy header trust for tests that rely on header-based detection
    process.env['SWML_TRUST_PROXY_HEADERS'] = 'true';
    agent = new AgentBase({ name: 'proxy-test', route: '/', basicAuth: ['user', 'pass'] });
    agent.setPromptText('test prompt');
  });

  it('getFullUrl returns localhost by default', () => {
    const url = agent.getFullUrl();
    expect(url).toContain('localhost');
  });

  it('manualSetProxyUrl overrides getFullUrl', () => {
    agent.manualSetProxyUrl('https://tunnel.example.com');
    const url = agent.getFullUrl();
    expect(url).toBe('https://tunnel.example.com');
  });

  it('manualSetProxyUrl strips trailing slashes', () => {
    agent.manualSetProxyUrl('https://tunnel.example.com///');
    const url = agent.getFullUrl();
    expect(url).toBe('https://tunnel.example.com');
  });

  it('manualSetProxyUrl with auth', () => {
    agent.manualSetProxyUrl('https://tunnel.example.com');
    const url = agent.getFullUrl(true);
    expect(url).toBe('https://user:pass@tunnel.example.com');
  });

  it('detects proxy from X-Forwarded-Host in SWML request', async () => {
    const app = agent.getApp();
    const res = await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'X-Forwarded-Host': 'ngrok.example.com',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({}),
    });
    expect(res.status).toBe(200);
    // After request, the agent should have detected the proxy
    expect(agent.getFullUrl()).toBe('https://ngrok.example.com');
  });

  it('detects proxy from X-Forwarded-Host defaults to https', async () => {
    const app = agent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'X-Forwarded-Host': 'tunnel.io',
      },
      body: JSON.stringify({}),
    });
    expect(agent.getFullUrl()).toBe('https://tunnel.io');
  });

  it('detects proxy from Forwarded header (RFC 7239)', async () => {
    const app = agent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'Forwarded': 'host=proxy.example.com;proto=https',
      },
      body: JSON.stringify({}),
    });
    expect(agent.getFullUrl()).toBe('https://proxy.example.com');
  });

  it('detects proxy from Forwarded header with default proto', async () => {
    const app = agent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'Forwarded': 'host=proxy.example.com',
      },
      body: JSON.stringify({}),
    });
    expect(agent.getFullUrl()).toBe('https://proxy.example.com');
  });

  it('detects proxy from X-Original-Host', async () => {
    const app = agent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'X-Original-Host': 'original.example.com',
      },
      body: JSON.stringify({}),
    });
    expect(agent.getFullUrl()).toBe('https://original.example.com');
  });

  it('X-Forwarded-Host takes priority over Forwarded header', async () => {
    const app = agent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'X-Forwarded-Host': 'xfh.example.com',
        'X-Forwarded-Proto': 'https',
        'Forwarded': 'host=fwd.example.com;proto=https',
      },
      body: JSON.stringify({}),
    });
    expect(agent.getFullUrl()).toBe('https://xfh.example.com');
  });

  it('env var SWML_PROXY_URL_BASE takes priority and is never overridden', async () => {
    process.env['SWML_PROXY_URL_BASE'] = 'https://env-proxy.example.com';
    process.env['SWML_TRUST_PROXY_HEADERS'] = 'true';
    const envAgent = new AgentBase({ name: 'env-test', route: '/', basicAuth: ['user', 'pass'] });
    envAgent.setPromptText('test');
    const app = envAgent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'X-Forwarded-Host': 'ngrok.example.com',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({}),
    });
    // Should still use env var, not detected proxy
    expect(envAgent.getFullUrl()).toBe('https://env-proxy.example.com');
    delete process.env['SWML_PROXY_URL_BASE'];
  });

  it('proxy URL is used in rendered SWML webhook URLs', async () => {
    agent.defineTool({
      name: 'test_fn',
      description: 'Test',
      parameters: {},
      handler: () => ({ response: 'ok' }),
    });

    const app = agent.getApp();
    const res = await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'X-Forwarded-Host': 'webhook.example.com',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({}),
    });
    const swml = await res.json();
    const webhookUrl = swml.sections.main[1].ai.SWAIG.defaults.web_hook_url;
    expect(webhookUrl).toContain('webhook.example.com');
    expect(webhookUrl).toContain('https://');
  });

  it('no proxy headers leaves getFullUrl unchanged', async () => {
    const beforeUrl = agent.getFullUrl();
    const app = agent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({}),
    });
    expect(agent.getFullUrl()).toBe(beforeUrl);
  });

  it('proxy detection disabled by default when SWML_TRUST_PROXY_HEADERS is not set', async () => {
    delete process.env['SWML_TRUST_PROXY_HEADERS'];
    const noTrustAgent = new AgentBase({ name: 'no-trust', route: '/', basicAuth: ['user', 'pass'] });
    noTrustAgent.setPromptText('test');
    const beforeUrl = noTrustAgent.getFullUrl();
    const app = noTrustAgent.getApp();
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'X-Forwarded-Host': 'should-be-ignored.com',
        'X-Forwarded-Proto': 'https',
      },
      body: JSON.stringify({}),
    });
    expect(noTrustAgent.getFullUrl()).toBe(beforeUrl);
  });

  it('invalid hostname in Forwarded header is rejected', async () => {
    const app = agent.getApp();
    const beforeUrl = agent.getFullUrl();
    // Use a hostname with a slash which will fail isValidHostname
    await app.request('http://localhost/', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa('user:pass'),
        'Content-Type': 'application/json',
        'Forwarded': 'host=evil/path;proto=https',
      },
      body: JSON.stringify({}),
    });
    // Should not have set proxy because hostname contains a slash
    expect(agent.getFullUrl()).toBe(beforeUrl);
  });

  afterEach(() => {
    delete process.env['SWML_TRUST_PROXY_HEADERS'];
  });
});
