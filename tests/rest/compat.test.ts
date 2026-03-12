import { HttpClient } from '../../src/rest/HttpClient.js';
import { CompatNamespace } from '../../src/rest/namespaces/compat.js';
import { mockClientOptions } from './helpers.js';

const SID = 'AC-test-sid';

describe('CompatNamespace', () => {
  function setup(responses: any[] = [{ status: 200, body: {} }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const compat = new CompatNamespace(http, SID);
    return { compat, getRequests };
  }

  const base = `/api/laml/2010-04-01/Accounts/${SID}`;

  describe('Accounts', () => {
    it('lists accounts (unscoped)', async () => {
      const { compat, getRequests } = setup();
      await compat.accounts.list();
      expect(getRequests()[0].url).toContain('/api/laml/2010-04-01/Accounts');
    });

    it('updates account with POST', async () => {
      const { compat, getRequests } = setup();
      await compat.accounts.update('AC1', { friendly_name: 'test' });
      expect(getRequests()[0].method).toBe('POST');
    });
  });

  describe('Calls', () => {
    it('lists calls at correct path', async () => {
      const { compat, getRequests } = setup();
      await compat.calls.list();
      expect(getRequests()[0].url).toContain(`${base}/Calls`);
    });

    it('creates a call', async () => {
      const { compat, getRequests } = setup();
      await compat.calls.create({ To: '+15551234567', From: '+15559876543' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].body.To).toBe('+15551234567');
    });

    it('updates with POST (not PATCH)', async () => {
      const { compat, getRequests } = setup();
      await compat.calls.update('CA1', { Status: 'completed' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].url).toContain(`${base}/Calls/CA1`);
    });

    it('starts a recording', async () => {
      const { compat, getRequests } = setup();
      await compat.calls.startRecording('CA1');
      expect(getRequests()[0].url).toContain(`${base}/Calls/CA1/Recordings`);
      expect(getRequests()[0].method).toBe('POST');
    });

    it('updates a recording', async () => {
      const { compat, getRequests } = setup();
      await compat.calls.updateRecording('CA1', 'RE1', { Status: 'paused' });
      expect(getRequests()[0].url).toContain(`${base}/Calls/CA1/Recordings/RE1`);
    });

    it('starts a stream', async () => {
      const { compat, getRequests } = setup();
      await compat.calls.startStream('CA1');
      expect(getRequests()[0].url).toContain(`${base}/Calls/CA1/Streams`);
    });

    it('stops a stream', async () => {
      const { compat, getRequests } = setup();
      await compat.calls.stopStream('CA1', 'ST1');
      expect(getRequests()[0].url).toContain(`${base}/Calls/CA1/Streams/ST1`);
    });
  });

  describe('Messages', () => {
    it('creates a message', async () => {
      const { compat, getRequests } = setup();
      await compat.messages.create({ To: '+15551234567', Body: 'hi' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].url).toContain(`${base}/Messages`);
    });

    it('updates with POST', async () => {
      const { compat, getRequests } = setup();
      await compat.messages.update('MM1', { Body: 'updated' });
      expect(getRequests()[0].method).toBe('POST');
    });

    it('lists media for a message', async () => {
      const { compat, getRequests } = setup();
      await compat.messages.listMedia('MM1');
      expect(getRequests()[0].url).toContain(`${base}/Messages/MM1/Media`);
    });

    it('gets media for a message', async () => {
      const { compat, getRequests } = setup();
      await compat.messages.getMedia('MM1', 'ME1');
      expect(getRequests()[0].url).toContain(`${base}/Messages/MM1/Media/ME1`);
    });

    it('deletes media', async () => {
      const { compat, getRequests } = setup([{ status: 204 }]);
      await compat.messages.deleteMedia('MM1', 'ME1');
      expect(getRequests()[0].method).toBe('DELETE');
    });
  });

  describe('Faxes', () => {
    it('lists faxes', async () => {
      const { compat, getRequests } = setup();
      await compat.faxes.list();
      expect(getRequests()[0].url).toContain(`${base}/Faxes`);
    });

    it('lists media for a fax', async () => {
      const { compat, getRequests } = setup();
      await compat.faxes.listMedia('FX1');
      expect(getRequests()[0].url).toContain(`${base}/Faxes/FX1/Media`);
    });
  });

  describe('Conferences', () => {
    it('lists conferences', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.list();
      expect(getRequests()[0].url).toContain(`${base}/Conferences`);
    });

    it('updates with POST', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.update('CF1', { Status: 'completed' });
      expect(getRequests()[0].method).toBe('POST');
    });

    it('lists participants', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.listParticipants('CF1');
      expect(getRequests()[0].url).toContain(`${base}/Conferences/CF1/Participants`);
    });

    it('gets a participant', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.getParticipant('CF1', 'CA1');
      expect(getRequests()[0].url).toContain(`${base}/Conferences/CF1/Participants/CA1`);
    });

    it('updates a participant with POST', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.updateParticipant('CF1', 'CA1', { Muted: true });
      expect(getRequests()[0].method).toBe('POST');
    });

    it('removes a participant', async () => {
      const { compat, getRequests } = setup([{ status: 204 }]);
      await compat.conferences.removeParticipant('CF1', 'CA1');
      expect(getRequests()[0].method).toBe('DELETE');
    });

    it('lists conference recordings', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.listRecordings('CF1');
      expect(getRequests()[0].url).toContain(`${base}/Conferences/CF1/Recordings`);
    });

    it('updates a conference recording with POST', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.updateRecording('CF1', 'RE1', { Status: 'paused' });
      expect(getRequests()[0].method).toBe('POST');
    });

    it('deletes a conference recording', async () => {
      const { compat, getRequests } = setup([{ status: 204 }]);
      await compat.conferences.deleteRecording('CF1', 'RE1');
      expect(getRequests()[0].method).toBe('DELETE');
    });

    it('starts a stream', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.startStream('CF1');
      expect(getRequests()[0].url).toContain(`${base}/Conferences/CF1/Streams`);
    });

    it('stops a stream', async () => {
      const { compat, getRequests } = setup();
      await compat.conferences.stopStream('CF1', 'ST1');
      expect(getRequests()[0].url).toContain(`${base}/Conferences/CF1/Streams/ST1`);
    });
  });

  describe('Phone Numbers', () => {
    it('lists incoming numbers', async () => {
      const { compat, getRequests } = setup();
      await compat.phoneNumbers.list();
      expect(getRequests()[0].url).toContain(`${base}/IncomingPhoneNumbers`);
    });

    it('purchases a number', async () => {
      const { compat, getRequests } = setup();
      await compat.phoneNumbers.purchase({ PhoneNumber: '+15551234567' });
      expect(getRequests()[0].method).toBe('POST');
    });

    it('updates with POST', async () => {
      const { compat, getRequests } = setup();
      await compat.phoneNumbers.update('PN1', { FriendlyName: 'main' });
      expect(getRequests()[0].method).toBe('POST');
    });

    it('imports a number', async () => {
      const { compat, getRequests } = setup();
      await compat.phoneNumbers.importNumber({ PhoneNumber: '+15551234567' });
      expect(getRequests()[0].url).toContain(`${base}/ImportedPhoneNumbers`);
    });

    it('lists available countries', async () => {
      const { compat, getRequests } = setup();
      await compat.phoneNumbers.listAvailableCountries();
      expect(getRequests()[0].url).toContain(`${base}/AvailablePhoneNumbers`);
    });

    it('searches local numbers', async () => {
      const { compat, getRequests } = setup();
      await compat.phoneNumbers.searchLocal('US', { AreaCode: '512' });
      expect(getRequests()[0].url).toContain(`${base}/AvailablePhoneNumbers/US/Local`);
      expect(getRequests()[0].url).toContain('AreaCode=512');
    });

    it('searches toll-free numbers', async () => {
      const { compat, getRequests } = setup();
      await compat.phoneNumbers.searchTollFree('US');
      expect(getRequests()[0].url).toContain(`${base}/AvailablePhoneNumbers/US/TollFree`);
    });
  });

  describe('Applications', () => {
    it('lists applications', async () => {
      const { compat, getRequests } = setup();
      await compat.applications.list();
      expect(getRequests()[0].url).toContain(`${base}/Applications`);
    });

    it('updates with POST', async () => {
      const { compat, getRequests } = setup();
      await compat.applications.update('AP1', { FriendlyName: 'updated' });
      expect(getRequests()[0].method).toBe('POST');
    });
  });

  describe('LaML Bins', () => {
    it('creates a LaML bin', async () => {
      const { compat, getRequests } = setup();
      await compat.lamlBins.create({ Name: 'test', Contents: '<Response/>' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].url).toContain(`${base}/LamlBins`);
    });
  });

  describe('Queues', () => {
    it('lists queues', async () => {
      const { compat, getRequests } = setup();
      await compat.queues.list();
      expect(getRequests()[0].url).toContain(`${base}/Queues`);
    });

    it('lists members', async () => {
      const { compat, getRequests } = setup();
      await compat.queues.listMembers('QU1');
      expect(getRequests()[0].url).toContain(`${base}/Queues/QU1/Members`);
    });

    it('gets a member', async () => {
      const { compat, getRequests } = setup();
      await compat.queues.getMember('QU1', 'CA1');
      expect(getRequests()[0].url).toContain(`${base}/Queues/QU1/Members/CA1`);
    });

    it('dequeues a member', async () => {
      const { compat, getRequests } = setup();
      await compat.queues.dequeueMember('QU1', 'CA1');
      expect(getRequests()[0].method).toBe('POST');
    });
  });

  describe('Recordings', () => {
    it('lists recordings', async () => {
      const { compat, getRequests } = setup();
      await compat.recordings.list();
      expect(getRequests()[0].url).toContain(`${base}/Recordings`);
    });

    it('deletes a recording', async () => {
      const { compat, getRequests } = setup([{ status: 204 }]);
      await compat.recordings.delete('RE1');
      expect(getRequests()[0].method).toBe('DELETE');
    });
  });

  describe('Transcriptions', () => {
    it('lists transcriptions', async () => {
      const { compat, getRequests } = setup();
      await compat.transcriptions.list();
      expect(getRequests()[0].url).toContain(`${base}/Transcriptions`);
    });

    it('deletes a transcription', async () => {
      const { compat, getRequests } = setup([{ status: 204 }]);
      await compat.transcriptions.delete('TR1');
      expect(getRequests()[0].method).toBe('DELETE');
    });
  });

  describe('Tokens', () => {
    it('creates a token', async () => {
      const { compat, getRequests } = setup();
      await compat.tokens.create({ label: 'test' });
      expect(getRequests()[0].url).toContain(`${base}/tokens`);
      expect(getRequests()[0].method).toBe('POST');
    });

    it('updates a token with PATCH', async () => {
      const { compat, getRequests } = setup();
      await compat.tokens.update('t1', { label: 'updated' });
      expect(getRequests()[0].method).toBe('PATCH');
    });

    it('deletes a token', async () => {
      const { compat, getRequests } = setup([{ status: 204 }]);
      await compat.tokens.delete('t1');
      expect(getRequests()[0].method).toBe('DELETE');
    });
  });
});
