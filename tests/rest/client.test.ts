import { SignalWireClient } from '../../src/rest/index.js';
import { createMockFetch } from './helpers.js';

describe('SignalWireClient', () => {
  const savedEnv: Record<string, string | undefined> = {};

  beforeEach(() => {
    // Save and clear REST-related env vars to prevent leaking between tests
    for (const key of ['SIGNALWIRE_PROJECT_ID', 'SIGNALWIRE_API_TOKEN', 'SIGNALWIRE_SPACE']) {
      savedEnv[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    // Restore
    for (const [key, val] of Object.entries(savedEnv)) {
      if (val === undefined) delete process.env[key];
      else process.env[key] = val;
    }
  });

  it('constructs with explicit options', () => {
    const [fetchImpl] = createMockFetch();
    const client = new SignalWireClient({
      project: 'proj-123',
      token: 'tok-456',
      host: 'test.signalwire.com',
      fetchImpl,
    });

    expect(client.fabric).toBeDefined();
    expect(client.calling).toBeDefined();
    expect(client.phoneNumbers).toBeDefined();
    expect(client.addresses).toBeDefined();
    expect(client.queues).toBeDefined();
    expect(client.recordings).toBeDefined();
    expect(client.numberGroups).toBeDefined();
    expect(client.verifiedCallers).toBeDefined();
    expect(client.sipProfile).toBeDefined();
    expect(client.lookup).toBeDefined();
    expect(client.shortCodes).toBeDefined();
    expect(client.importedNumbers).toBeDefined();
    expect(client.mfa).toBeDefined();
    expect(client.registry).toBeDefined();
    expect(client.datasphere).toBeDefined();
    expect(client.video).toBeDefined();
    expect(client.logs).toBeDefined();
    expect(client.project).toBeDefined();
    expect(client.pubsub).toBeDefined();
    expect(client.chat).toBeDefined();
    expect(client.compat).toBeDefined();
  });

  it('throws when project is missing', () => {
    const [fetchImpl] = createMockFetch();
    expect(() => new SignalWireClient({
      token: 'tok',
      host: 'test.signalwire.com',
      fetchImpl,
    })).toThrow(/project, token, and host are required/);
  });

  it('throws when token is missing', () => {
    const [fetchImpl] = createMockFetch();
    expect(() => new SignalWireClient({
      project: 'proj',
      host: 'test.signalwire.com',
      fetchImpl,
    })).toThrow(/project, token, and host are required/);
  });

  it('throws when host is missing', () => {
    const [fetchImpl] = createMockFetch();
    expect(() => new SignalWireClient({
      project: 'proj',
      token: 'tok',
      fetchImpl,
    })).toThrow(/project, token, and host are required/);
  });

  it('reads from environment variables', () => {
    const [fetchImpl] = createMockFetch();
    process.env['SIGNALWIRE_PROJECT_ID'] = 'env-proj';
    process.env['SIGNALWIRE_API_TOKEN'] = 'env-tok';
    process.env['SIGNALWIRE_SPACE'] = 'env.signalwire.com';

    const client = new SignalWireClient({ fetchImpl });
    expect(client.fabric).toBeDefined();
  });

  it('explicit options override env vars', () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },
    ]);
    process.env['SIGNALWIRE_PROJECT_ID'] = 'env-proj';
    process.env['SIGNALWIRE_API_TOKEN'] = 'env-tok';
    process.env['SIGNALWIRE_SPACE'] = 'env.signalwire.com';

    const client = new SignalWireClient({
      project: 'explicit-proj',
      token: 'explicit-tok',
      host: 'explicit.signalwire.com',
      fetchImpl,
    });

    // Verify by making a request and checking the auth header + URL
    client.phoneNumbers.list();
    const reqs = getRequests();
    // Auth header should use explicit creds
    const expected = 'Basic ' + Buffer.from('explicit-proj:explicit-tok').toString('base64');
    expect(reqs[0].headers['Authorization']).toBe(expected);
    // URL should use explicit host
    expect(reqs[0].url).toContain('explicit.signalwire.com');
  });

  it('normalizes host without https://', () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },
    ]);
    const client = new SignalWireClient({
      project: 'proj',
      token: 'tok',
      host: 'my.signalwire.com',
      fetchImpl,
    });

    client.phoneNumbers.list();
    expect(getRequests()[0].url).toMatch(/^https:\/\/my\.signalwire\.com/);
  });

  it('preserves https:// if already present', () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },
    ]);
    const client = new SignalWireClient({
      project: 'proj',
      token: 'tok',
      host: 'https://my.signalwire.com',
      fetchImpl,
    });

    client.phoneNumbers.list();
    expect(getRequests()[0].url).toMatch(/^https:\/\/my\.signalwire\.com/);
    expect(getRequests()[0].url).not.toContain('https://https://');
  });

  it('compat namespace is scoped to project ID', async () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { calls: [] } },
    ]);
    const client = new SignalWireClient({
      project: 'proj-abc',
      token: 'tok',
      host: 'test.signalwire.com',
      fetchImpl,
    });

    await client.compat.calls.list();
    expect(getRequests()[0].url).toContain('/api/laml/2010-04-01/Accounts/proj-abc/Calls');
  });

  it('all namespaces route through same HttpClient', async () => {
    const [fetchImpl, getRequests] = createMockFetch([
      { status: 200, body: { data: [] } },  // fabric
      { status: 200, body: {} },             // calling
      { status: 200, body: { data: [] } },   // phoneNumbers
      { status: 200, body: { data: [] } },   // video
    ]);
    const client = new SignalWireClient({
      project: 'proj',
      token: 'tok',
      host: 'test.signalwire.com',
      fetchImpl,
    });

    await client.fabric.aiAgents.list();
    await client.calling.dial({ to: '+1' });
    await client.phoneNumbers.list();
    await client.video.rooms.list();

    const reqs = getRequests();
    expect(reqs).toHaveLength(4);

    // All should use same auth
    const auth = reqs[0].headers['Authorization'];
    for (const req of reqs) {
      expect(req.headers['Authorization']).toBe(auth);
    }

    // Verify different paths
    expect(reqs[0].url).toContain('/api/fabric/resources/ai_agents');
    expect(reqs[1].url).toContain('/api/calling/calls');
    expect(reqs[2].url).toContain('/api/relay/rest/phone_numbers');
    expect(reqs[3].url).toContain('/api/video/rooms');
  });
});
