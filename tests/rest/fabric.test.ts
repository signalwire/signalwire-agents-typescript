import { HttpClient } from '../../src/rest/HttpClient.js';
import { FabricNamespace } from '../../src/rest/namespaces/fabric.js';
import { mockClientOptions } from './helpers.js';

describe('FabricNamespace', () => {
  function setup(responses: any[] = [{ status: 200, body: { data: [] } }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const fabric = new FabricNamespace(http);
    return { fabric, getRequests };
  }

  describe('AI Agents (PATCH-update)', () => {
    it('lists ai agents', async () => {
      const { fabric, getRequests } = setup();
      await fabric.aiAgents.list();
      expect(getRequests()[0].url).toContain('/api/fabric/resources/ai_agents');
      expect(getRequests()[0].method).toBe('GET');
    });

    it('creates an ai agent', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'a1' } }]);
      await fabric.aiAgents.create({ name: 'test' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].body).toEqual({ name: 'test' });
    });

    it('updates ai agent with PATCH', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'a1' } }]);
      await fabric.aiAgents.update('a1', { name: 'updated' });
      expect(getRequests()[0].method).toBe('PATCH');
    });

    it('lists addresses for ai agent', async () => {
      const { fabric, getRequests } = setup();
      await fabric.aiAgents.listAddresses('a1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/ai_agents/a1/addresses');
    });
  });

  describe('SWML Scripts (PUT-update)', () => {
    it('updates swml script with PUT', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 's1' } }]);
      await fabric.swmlScripts.update('s1', { code: 'new' });
      expect(getRequests()[0].method).toBe('PUT');
    });
  });

  describe('Call Flows', () => {
    it('uses singular call_flow for addresses', async () => {
      const { fabric, getRequests } = setup();
      await fabric.callFlows.listAddresses('cf1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/call_flow/cf1/addresses');
    });

    it('lists versions', async () => {
      const { fabric, getRequests } = setup();
      await fabric.callFlows.listVersions('cf1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/call_flow/cf1/versions');
    });

    it('deploys a version', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { version: 2 } }]);
      await fabric.callFlows.deployVersion('cf1', { version: 2 });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/call_flow/cf1/versions');
    });
  });

  describe('Conference Rooms', () => {
    it('uses singular conference_room for addresses', async () => {
      const { fabric, getRequests } = setup();
      await fabric.conferenceRooms.listAddresses('cr1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/conference_room/cr1/addresses');
    });
  });

  describe('Subscribers', () => {
    it('lists SIP endpoints', async () => {
      const { fabric, getRequests } = setup();
      await fabric.subscribers.listSipEndpoints('sub1');
      expect(getRequests()[0].url).toContain('/api/fabric/resources/subscribers/sub1/sip_endpoints');
    });

    it('creates a SIP endpoint', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'ep1' } }]);
      await fabric.subscribers.createSipEndpoint('sub1', { username: 'test' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].body).toEqual({ username: 'test' });
    });

    it('gets a SIP endpoint', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'ep1' } }]);
      await fabric.subscribers.getSipEndpoint('sub1', 'ep1');
      expect(getRequests()[0].url).toContain('/subscribers/sub1/sip_endpoints/ep1');
    });

    it('updates a SIP endpoint with PATCH', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.subscribers.updateSipEndpoint('sub1', 'ep1', { password: 'new' });
      expect(getRequests()[0].method).toBe('PATCH');
    });

    it('deletes a SIP endpoint', async () => {
      const { fabric, getRequests } = setup([{ status: 204 }]);
      await fabric.subscribers.deleteSipEndpoint('sub1', 'ep1');
      expect(getRequests()[0].method).toBe('DELETE');
    });
  });

  describe('CXML Applications', () => {
    it('throws on create', async () => {
      const { fabric } = setup();
      await expect(fabric.cxmlApplications.create()).rejects.toThrow('cannot be created');
    });
  });

  describe('Generic Resources', () => {
    it('lists all resources', async () => {
      const { fabric, getRequests } = setup();
      await fabric.resources.list();
      expect(getRequests()[0].url).toContain('/api/fabric/resources');
      expect(getRequests()[0].url).not.toContain('/api/fabric/resources/');
    });

    it('assigns phone route', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.resources.assignPhoneRoute('r1', { number: '+15551234567' });
      expect(getRequests()[0].url).toContain('/api/fabric/resources/r1/phone_routes');
      expect(getRequests()[0].method).toBe('POST');
    });

    it('assigns domain application', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.resources.assignDomainApplication('r1', { domain: 'test.com' });
      expect(getRequests()[0].url).toContain('/api/fabric/resources/r1/domain_applications');
    });
  });

  describe('Addresses', () => {
    it('lists addresses', async () => {
      const { fabric, getRequests } = setup();
      await fabric.addresses.list();
      expect(getRequests()[0].url).toContain('/api/fabric/addresses');
    });

    it('gets an address', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { id: 'addr1' } }]);
      await fabric.addresses.get('addr1');
      expect(getRequests()[0].url).toContain('/api/fabric/addresses/addr1');
    });
  });

  describe('Tokens', () => {
    it('creates subscriber token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { token: 'xxx' } }]);
      await fabric.tokens.createSubscriberToken({ subscriber_id: 's1' });
      expect(getRequests()[0].url).toContain('/api/fabric/subscribers/tokens');
      expect(getRequests()[0].method).toBe('POST');
    });

    it('refreshes subscriber token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: { token: 'xxx' } }]);
      await fabric.tokens.refreshSubscriberToken({ token: 'old' });
      expect(getRequests()[0].url).toContain('/api/fabric/subscribers/tokens/refresh');
    });

    it('creates invite token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.tokens.createInviteToken({});
      expect(getRequests()[0].url).toContain('/api/fabric/subscriber/invites');
    });

    it('creates guest token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.tokens.createGuestToken({});
      expect(getRequests()[0].url).toContain('/api/fabric/guests/tokens');
    });

    it('creates embed token', async () => {
      const { fabric, getRequests } = setup([{ status: 200, body: {} }]);
      await fabric.tokens.createEmbedToken({});
      expect(getRequests()[0].url).toContain('/api/fabric/embeds/tokens');
    });
  });
});
