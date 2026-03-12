import { HttpClient } from '../../src/rest/HttpClient.js';
import { LogsNamespace } from '../../src/rest/namespaces/logs.js';
import { mockClientOptions } from './helpers.js';

describe('LogsNamespace', () => {
  function setup(responses: any[] = [{ status: 200, body: { data: [] } }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const logs = new LogsNamespace(http);
    return { logs, getRequests };
  }

  describe('Message Logs', () => {
    it('lists message logs', async () => {
      const { logs, getRequests } = setup();
      await logs.messages.list();
      expect(getRequests()[0].url).toContain('/api/messaging/logs');
    });

    it('gets a message log', async () => {
      const { logs, getRequests } = setup([{ status: 200, body: { id: 'ml1' } }]);
      await logs.messages.get('ml1');
      expect(getRequests()[0].url).toContain('/api/messaging/logs/ml1');
    });
  });

  describe('Voice Logs', () => {
    it('lists voice logs', async () => {
      const { logs, getRequests } = setup();
      await logs.voice.list();
      expect(getRequests()[0].url).toContain('/api/voice/logs');
    });

    it('gets a voice log', async () => {
      const { logs, getRequests } = setup([{ status: 200, body: { id: 'vl1' } }]);
      await logs.voice.get('vl1');
      expect(getRequests()[0].url).toContain('/api/voice/logs/vl1');
    });

    it('lists events for a voice log', async () => {
      const { logs, getRequests } = setup();
      await logs.voice.listEvents('vl1');
      expect(getRequests()[0].url).toContain('/api/voice/logs/vl1/events');
    });
  });

  describe('Fax Logs', () => {
    it('lists fax logs', async () => {
      const { logs, getRequests } = setup();
      await logs.fax.list();
      expect(getRequests()[0].url).toContain('/api/fax/logs');
    });

    it('gets a fax log', async () => {
      const { logs, getRequests } = setup([{ status: 200, body: { id: 'fl1' } }]);
      await logs.fax.get('fl1');
      expect(getRequests()[0].url).toContain('/api/fax/logs/fl1');
    });
  });

  describe('Conference Logs', () => {
    it('lists conference logs', async () => {
      const { logs, getRequests } = setup();
      await logs.conferences.list();
      expect(getRequests()[0].url).toContain('/api/logs/conferences');
    });
  });
});
