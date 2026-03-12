/**
 * REST Example: Video rooms for team standup and conference streaming.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-video-rooms.ts
 */

import { SignalWireClient, RestError } from '../../src/index.js';

const client = new SignalWireClient();

async function main() {
  // --- Video Rooms ---

  // 1. Create a video room
  console.log('Creating video room...');
  const room = await client.video.rooms.create({
    name: 'daily-standup',
    display_name: 'Daily Standup',
    max_members: 10,
    layout: 'grid-responsive',
  });
  const roomId = room.id;
  console.log(`  Created room: ${roomId}`);

  // 2. List video rooms
  console.log('\nListing video rooms...');
  const rooms = await client.video.rooms.list();
  for (const r of (rooms.data ?? []).slice(0, 5)) {
    console.log(`  - ${r.id}: ${r.name ?? 'unnamed'}`);
  }

  // 3. Generate a join token
  console.log('\nGenerating room token...');
  try {
    const token = await client.video.roomTokens.create({
      room_name: 'daily-standup',
      user_name: 'alice',
      permissions: ['room.self.audio_mute', 'room.self.video_mute'],
    });
    console.log(`  Token: ${String(token.token ?? '').slice(0, 40)}...`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Token failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // --- Sessions ---

  // 4. List room sessions
  console.log('\nListing room sessions...');
  const sessions = await client.video.roomSessions.list();
  for (const s of (sessions.data ?? []).slice(0, 3)) {
    console.log(`  - Session ${s.id}: ${s.status ?? 'unknown'}`);
  }

  // 5. Get session details with members, events, recordings
  const firstSession = (sessions.data ?? [{}])[0];
  if (firstSession?.id) {
    const sid = firstSession.id;
    const detail = await client.video.roomSessions.get(sid);
    console.log(`  Session: ${detail.name ?? 'N/A'} (${detail.status ?? 'N/A'})`);

    const members = await client.video.roomSessions.listMembers(sid);
    console.log(`  Members: ${(members.data ?? []).length}`);

    const events = await client.video.roomSessions.listEvents(sid);
    console.log(`  Events: ${(events.data ?? []).length}`);

    const recs = await client.video.roomSessions.listRecordings(sid);
    console.log(`  Recordings: ${(recs.data ?? []).length}`);
  }

  // --- Room Recordings ---

  // 6. List and get room recordings
  console.log('\nListing room recordings...');
  const roomRecs = await client.video.roomRecordings.list();
  for (const rr of (roomRecs.data ?? []).slice(0, 3)) {
    console.log(`  - Recording ${rr.id}: ${rr.duration ?? 'N/A'}s`);
  }

  const firstRec = (roomRecs.data ?? [{}])[0];
  if (firstRec?.id) {
    const recDetail = await client.video.roomRecordings.get(firstRec.id);
    console.log(`  Recording detail: ${recDetail.duration ?? 'N/A'}s`);

    const recEvents = await client.video.roomRecordings.listEvents(firstRec.id);
    console.log(`  Recording events: ${(recEvents.data ?? []).length}`);
  }

  // --- Video Conferences ---

  // 7. Create a video conference
  console.log('\nCreating video conference...');
  let confId: string | null = null;
  try {
    const conf = await client.video.conferences.create({
      name: 'all-hands-stream',
      display_name: 'All Hands Meeting',
    });
    confId = conf.id;
    console.log(`  Created conference: ${confId}`);
  } catch (err) {
    if (err instanceof RestError) {
      console.log(`  Conference creation failed (expected in demo): ${err.statusCode}`);
    } else throw err;
  }

  // 8. List conference tokens
  if (confId) {
    console.log('\nListing conference tokens...');
    try {
      const tokens = await client.video.conferences.listConferenceTokens(confId);
      for (const t of tokens.data ?? []) {
        console.log(`  - Token: ${t.id ?? 'unknown'}`);
      }
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Conference tokens failed: ${err.statusCode}`);
      } else throw err;
    }
  }

  // 9. Create a stream on the conference
  let streamId: string | null = null;
  if (confId) {
    console.log('\nCreating stream on conference...');
    try {
      const stream = await client.video.conferences.createStream(confId, {
        url: 'rtmp://live.example.com/stream-key',
      });
      streamId = stream.id;
      console.log(`  Created stream: ${streamId}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Stream creation failed (expected in demo): ${err.statusCode}`);
      } else throw err;
    }
  }

  // 10. Get and update stream
  if (streamId) {
    console.log(`\nManaging stream ${streamId}...`);
    try {
      const sDetail = await client.video.streams.get(streamId);
      console.log(`  Stream URL: ${sDetail.url ?? 'N/A'}`);

      await client.video.streams.update(streamId, { url: 'rtmp://backup.example.com/stream-key' });
      console.log('  Stream URL updated');
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Stream ops failed: ${err.statusCode}`);
      } else throw err;
    }
  }

  // 11. Clean up
  console.log('\nCleaning up...');
  if (streamId) {
    try {
      await client.video.streams.delete(streamId);
      console.log(`  Deleted stream ${streamId}`);
    } catch (err) {
      if (err instanceof RestError) {
        console.log(`  Stream delete failed: ${err.statusCode}`);
      } else throw err;
    }
  }
  if (confId) {
    await client.video.conferences.delete(confId);
    console.log(`  Deleted conference ${confId}`);
  }
  await client.video.rooms.delete(roomId);
  console.log(`  Deleted room ${roomId}`);
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
