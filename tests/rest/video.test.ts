import { HttpClient } from '../../src/rest/HttpClient.js';
import { VideoNamespace } from '../../src/rest/namespaces/video.js';
import { mockClientOptions } from './helpers.js';

describe('VideoNamespace', () => {
  function setup(responses: any[] = [{ status: 200, body: { data: [] } }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const video = new VideoNamespace(http);
    return { video, getRequests };
  }

  describe('Rooms', () => {
    it('lists rooms', async () => {
      const { video, getRequests } = setup();
      await video.rooms.list();
      expect(getRequests()[0].url).toContain('/api/video/rooms');
    });

    it('creates a room', async () => {
      const { video, getRequests } = setup([{ status: 200, body: { id: 'r1' } }]);
      await video.rooms.create({ name: 'test' });
      expect(getRequests()[0].method).toBe('POST');
    });

    it('updates with PUT', async () => {
      const { video, getRequests } = setup([{ status: 200, body: {} }]);
      await video.rooms.update('r1', { name: 'updated' });
      expect(getRequests()[0].method).toBe('PUT');
    });

    it('lists streams for a room', async () => {
      const { video, getRequests } = setup();
      await video.rooms.listStreams('r1');
      expect(getRequests()[0].url).toContain('/api/video/rooms/r1/streams');
    });

    it('creates a stream for a room', async () => {
      const { video, getRequests } = setup([{ status: 200, body: {} }]);
      await video.rooms.createStream('r1', { url: 'rtmp://...' });
      expect(getRequests()[0].method).toBe('POST');
      expect(getRequests()[0].url).toContain('/api/video/rooms/r1/streams');
    });
  });

  describe('Room Tokens', () => {
    it('creates a room token', async () => {
      const { video, getRequests } = setup([{ status: 200, body: { token: 'xxx' } }]);
      await video.roomTokens.create({ room_name: 'test' });
      expect(getRequests()[0].url).toContain('/api/video/room_tokens');
      expect(getRequests()[0].method).toBe('POST');
    });
  });

  describe('Room Sessions', () => {
    it('lists sessions', async () => {
      const { video, getRequests } = setup();
      await video.roomSessions.list();
      expect(getRequests()[0].url).toContain('/api/video/room_sessions');
    });

    it('gets a session', async () => {
      const { video, getRequests } = setup([{ status: 200, body: { id: 's1' } }]);
      await video.roomSessions.get('s1');
      expect(getRequests()[0].url).toContain('/api/video/room_sessions/s1');
    });

    it('lists events for a session', async () => {
      const { video, getRequests } = setup();
      await video.roomSessions.listEvents('s1');
      expect(getRequests()[0].url).toContain('/api/video/room_sessions/s1/events');
    });

    it('lists members for a session', async () => {
      const { video, getRequests } = setup();
      await video.roomSessions.listMembers('s1');
      expect(getRequests()[0].url).toContain('/api/video/room_sessions/s1/members');
    });

    it('lists recordings for a session', async () => {
      const { video, getRequests } = setup();
      await video.roomSessions.listRecordings('s1');
      expect(getRequests()[0].url).toContain('/api/video/room_sessions/s1/recordings');
    });
  });

  describe('Room Recordings', () => {
    it('lists recordings', async () => {
      const { video, getRequests } = setup();
      await video.roomRecordings.list();
      expect(getRequests()[0].url).toContain('/api/video/room_recordings');
    });

    it('deletes a recording', async () => {
      const { video, getRequests } = setup([{ status: 204 }]);
      await video.roomRecordings.delete('rec1');
      expect(getRequests()[0].method).toBe('DELETE');
    });

    it('lists events for a recording', async () => {
      const { video, getRequests } = setup();
      await video.roomRecordings.listEvents('rec1');
      expect(getRequests()[0].url).toContain('/api/video/room_recordings/rec1/events');
    });
  });

  describe('Conferences', () => {
    it('lists conferences', async () => {
      const { video, getRequests } = setup();
      await video.conferences.list();
      expect(getRequests()[0].url).toContain('/api/video/conferences');
    });

    it('updates with PUT', async () => {
      const { video, getRequests } = setup([{ status: 200, body: {} }]);
      await video.conferences.update('c1', { name: 'updated' });
      expect(getRequests()[0].method).toBe('PUT');
    });

    it('lists conference tokens', async () => {
      const { video, getRequests } = setup();
      await video.conferences.listConferenceTokens('c1');
      expect(getRequests()[0].url).toContain('/api/video/conferences/c1/conference_tokens');
    });

    it('lists streams for a conference', async () => {
      const { video, getRequests } = setup();
      await video.conferences.listStreams('c1');
      expect(getRequests()[0].url).toContain('/api/video/conferences/c1/streams');
    });

    it('creates a stream for a conference', async () => {
      const { video, getRequests } = setup([{ status: 200, body: {} }]);
      await video.conferences.createStream('c1', { url: 'rtmp://...' });
      expect(getRequests()[0].method).toBe('POST');
    });
  });

  describe('Conference Tokens', () => {
    it('gets a token', async () => {
      const { video, getRequests } = setup([{ status: 200, body: { id: 't1' } }]);
      await video.conferenceTokens.get('t1');
      expect(getRequests()[0].url).toContain('/api/video/conference_tokens/t1');
    });

    it('resets a token', async () => {
      const { video, getRequests } = setup([{ status: 200, body: {} }]);
      await video.conferenceTokens.reset('t1');
      expect(getRequests()[0].url).toContain('/api/video/conference_tokens/t1/reset');
      expect(getRequests()[0].method).toBe('POST');
    });
  });

  describe('Streams', () => {
    it('gets a stream', async () => {
      const { video, getRequests } = setup([{ status: 200, body: { id: 'st1' } }]);
      await video.streams.get('st1');
      expect(getRequests()[0].url).toContain('/api/video/streams/st1');
    });

    it('updates with PUT', async () => {
      const { video, getRequests } = setup([{ status: 200, body: {} }]);
      await video.streams.update('st1', { name: 'updated' });
      expect(getRequests()[0].method).toBe('PUT');
    });

    it('deletes a stream', async () => {
      const { video, getRequests } = setup([{ status: 204 }]);
      await video.streams.delete('st1');
      expect(getRequests()[0].method).toBe('DELETE');
    });
  });
});
