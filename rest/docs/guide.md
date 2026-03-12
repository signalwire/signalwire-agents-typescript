# REST Client Guide

The SignalWire REST client provides typed HTTP access to all SignalWire platform APIs. It's a standalone module that doesn't depend on AgentBase — you can use it independently for any server-side integration.

## Quick Start

```typescript
import { SignalWireClient } from 'signalwire-agents';

const client = new SignalWireClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'your-space.signalwire.com',
});

// List AI agents
const agents = await client.fabric.aiAgents.list();

// Search phone numbers
const numbers = await client.phoneNumbers.search({ area_code: '512' });

// Make a REST call
await client.calling.play('call-id', { url: 'https://example.com/audio.mp3' });
```

## Authentication

The client uses HTTP Basic Auth with your project ID and API token. Credentials can be provided explicitly or via environment variables:

| Option | Environment Variable |
|--------|---------------------|
| `project` | `SIGNALWIRE_PROJECT_ID` |
| `token` | `SIGNALWIRE_API_TOKEN` |
| `host` | `SIGNALWIRE_SPACE` |

```typescript
// Using environment variables (no args needed)
const client = new SignalWireClient();
```

## Namespaces

The client organizes all APIs into namespaces:

### Fabric (`client.fabric.*`)

Resource management for the SignalWire Fabric platform.

```typescript
// AI Agents (PATCH updates)
await client.fabric.aiAgents.list();
await client.fabric.aiAgents.create({ name: 'My Agent' });
await client.fabric.aiAgents.get('agent-id');
await client.fabric.aiAgents.update('agent-id', { name: 'Updated' });
await client.fabric.aiAgents.delete('agent-id');
await client.fabric.aiAgents.listAddresses('agent-id');

// SWML Scripts (PUT updates)
await client.fabric.swmlScripts.create({ name: 'flow', code: '...' });
await client.fabric.swmlScripts.update('id', { code: '...' });

// Call Flows (with version management)
await client.fabric.callFlows.list();
await client.fabric.callFlows.listVersions('cf-id');
await client.fabric.callFlows.deployVersion('cf-id', { version: 2 });

// Subscribers (with SIP endpoints)
await client.fabric.subscribers.listSipEndpoints('sub-id');
await client.fabric.subscribers.createSipEndpoint('sub-id', { username: 'user' });

// Tokens
await client.fabric.tokens.createSubscriberToken({ subscriber_id: 's1' });
await client.fabric.tokens.createGuestToken({ resource_id: 'r1' });
```

**Sub-resources:** `swmlScripts`, `relayApplications`, `callFlows`, `conferenceRooms`, `freeswitchConnectors`, `subscribers`, `sipEndpoints`, `cxmlScripts`, `cxmlApplications`, `swmlWebhooks`, `aiAgents`, `sipGateways`, `cxmlWebhooks`, `resources`, `addresses`, `tokens`

### Calling (`client.calling.*`)

REST-based call control — all 37 commands dispatched via POST.

```typescript
// Dial
await client.calling.dial({ to: '+15551234567', from: '+15559876543' });

// Play audio
await client.calling.play('call-id', { url: 'https://example.com/audio.mp3' });
await client.calling.playPause('call-id');
await client.calling.playResume('call-id');
await client.calling.playStop('call-id');

// Record
await client.calling.record('call-id', { beep: true });
await client.calling.recordStop('call-id');

// AI control
await client.calling.aiMessage('call-id', { message: 'Hello' });
await client.calling.aiStop('call-id');

// End call
await client.calling.end('call-id');
```

### Phone Numbers (`client.phoneNumbers`)

```typescript
await client.phoneNumbers.list();
await client.phoneNumbers.search({ area_code: '512' });
await client.phoneNumbers.create({ number: '+15551234567' }); // Purchase
await client.phoneNumbers.update('id', { name: 'Main Line' });
await client.phoneNumbers.delete('id'); // Release
```

### Datasphere (`client.datasphere.*`)

Document management and semantic search.

```typescript
// Documents
await client.datasphere.documents.list();
await client.datasphere.documents.create({ name: 'FAQ', content: '...' });
await client.datasphere.documents.get('doc-id');
await client.datasphere.documents.update('doc-id', { name: 'Updated FAQ' });
await client.datasphere.documents.delete('doc-id');

// Search
await client.datasphere.documents.search({ query: 'how do I reset my password', count: 5 });

// Chunks
await client.datasphere.documents.listChunks('doc-id');
await client.datasphere.documents.getChunk('doc-id', 'chunk-id');
await client.datasphere.documents.deleteChunk('doc-id', 'chunk-id');
```

### Video (`client.video.*`)

```typescript
// Rooms
await client.video.rooms.list();
await client.video.rooms.create({ name: 'standup' });
await client.video.rooms.update('room-id', { max_participants: 10 });
await client.video.rooms.listStreams('room-id');
await client.video.rooms.createStream('room-id', { url: 'rtmp://...' });

// Room Tokens
await client.video.roomTokens.create({ room_name: 'standup', user_name: 'alice' });

// Sessions
await client.video.roomSessions.list();
await client.video.roomSessions.listMembers('session-id');
await client.video.roomSessions.listRecordings('session-id');

// Conferences
await client.video.conferences.list();
await client.video.conferences.listConferenceTokens('conf-id');
```

### Compatibility API (`client.compat.*`)

Twilio-compatible LAML API — scoped to your project ID as AccountSid. All updates use POST (not PATCH/PUT).

```typescript
// Calls
await client.compat.calls.list();
await client.compat.calls.create({ To: '+15551234567', From: '+15559876543', Url: '...' });
await client.compat.calls.update('CA...', { Status: 'completed' });
await client.compat.calls.startRecording('CA...');

// Messages
await client.compat.messages.create({ To: '+15551234567', Body: 'Hello' });
await client.compat.messages.listMedia('MM...');

// Phone Numbers
await client.compat.phoneNumbers.list();
await client.compat.phoneNumbers.searchLocal('US', { AreaCode: '512' });
await client.compat.phoneNumbers.searchTollFree('US');
await client.compat.phoneNumbers.purchase({ PhoneNumber: '+15551234567' });

// Conferences
await client.compat.conferences.list();
await client.compat.conferences.listParticipants('CF...');
await client.compat.conferences.updateParticipant('CF...', 'CA...', { Muted: true });
```

### Other Namespaces

```typescript
// Addresses
await client.addresses.list();
await client.addresses.create({ ... });

// Queues (with member management)
await client.queues.list();
await client.queues.listMembers('queue-id');
await client.queues.getNextMember('queue-id');

// Recordings
await client.recordings.list();
await client.recordings.get('recording-id');
await client.recordings.delete('recording-id');

// Number Groups (with membership)
await client.numberGroups.list();
await client.numberGroups.listMemberships('group-id');
await client.numberGroups.addMembership('group-id', { phone_number_id: 'pn-id' });

// Verified Callers
await client.verifiedCallers.list();
await client.verifiedCallers.create({ phone_number: '+15551234567' });
await client.verifiedCallers.submitVerification('id', { code: '1234' });

// SIP Profile (singleton)
await client.sipProfile.get();
await client.sipProfile.update({ codecs: ['PCMU', 'PCMA'] });

// Lookup
await client.lookup.phoneNumber('+15551234567', { include: 'cnam' });

// Short Codes
await client.shortCodes.list();
await client.shortCodes.update('sc-id', { url: 'https://...' });

// Imported Numbers
await client.importedNumbers.create({ number: '+15551234567' });

// MFA
await client.mfa.sms({ to: '+15551234567', from: '+15559876543' });
await client.mfa.call({ to: '+15551234567', from: '+15559876543' });
await client.mfa.verify('request-id', { token: '1234' });

// Registry (10DLC)
await client.registry.brands.list();
await client.registry.brands.createCampaign('brand-id', { use_case: 'marketing' });
await client.registry.campaigns.listNumbers('campaign-id');

// Logs
await client.logs.voice.list({ page_size: 10 });
await client.logs.voice.listEvents('log-id');
await client.logs.messages.list();
await client.logs.fax.list();
await client.logs.conferences.list();

// Project tokens
await client.project.tokens.create({ label: 'ci-token' });
await client.project.tokens.update('token-id', { label: 'updated' });
await client.project.tokens.delete('token-id');

// PubSub & Chat tokens
await client.pubsub.createToken({ channels: ['updates'] });
await client.chat.createToken({ member_id: 'user-1' });
```

## Pagination

The client provides two pagination utilities that work with both standard (`links.next`) and LAML (`next_page_uri`) pagination styles.

### Async Generator

```typescript
import { SignalWireClient, paginate, HttpClient } from 'signalwire-agents';

// paginate() yields items one at a time across pages
for await (const number of paginate(httpClient, '/api/relay/rest/phone_numbers')) {
  console.log(number.id, number.number);
}
```

### Collect All

```typescript
import { paginateAll } from 'signalwire-agents';

const allNumbers = await paginateAll(httpClient, '/api/relay/rest/phone_numbers');
console.log(`Total: ${allNumbers.length}`);
```

### Custom Data Key

Some APIs use different keys for the data array. Use the `dataKey` parameter:

```typescript
// LAML uses resource-specific keys like "calls", "messages"
const allCalls = await paginateAll(httpClient, '/api/laml/.../Calls', undefined, 'calls');
```

## Error Handling

All HTTP errors throw `RestError` with status code, body, URL, and method:

```typescript
import { RestError } from 'signalwire-agents';

try {
  await client.phoneNumbers.get('nonexistent');
} catch (err) {
  if (err instanceof RestError) {
    console.error(`${err.method} ${err.url} returned ${err.statusCode}`);
    console.error('Body:', err.body);
  }
}
```

## Test Injection

For testing, inject a custom `fetch` implementation:

```typescript
const mockFetch = async (url, init) => new Response(JSON.stringify({ data: [] }));

const client = new SignalWireClient({
  project: 'test',
  token: 'test',
  host: 'test.signalwire.com',
  fetchImpl: mockFetch,
});
```

This follows the same pattern as the RELAY client's `_wsFactory` injection.

## Architecture

```
SignalWireClient
  ├── HttpClient (fetch + Basic Auth)
  ├── fabric: FabricNamespace (17 sub-resources)
  ├── calling: CallingNamespace (37 commands)
  ├── phoneNumbers: PhoneNumbersResource (CRUD + search)
  ├── addresses: AddressesResource
  ├── queues: QueuesResource (CRUD + members)
  ├── recordings: RecordingsResource
  ├── numberGroups: NumberGroupsResource (CRUD + membership)
  ├── verifiedCallers: VerifiedCallersResource (CRUD + verify)
  ├── sipProfile: SipProfileResource (singleton)
  ├── lookup: LookupResource
  ├── shortCodes: ShortCodesResource
  ├── importedNumbers: ImportedNumbersResource
  ├── mfa: MfaResource
  ├── registry: RegistryNamespace (brands, campaigns, orders, numbers)
  ├── datasphere: DatasphereNamespace (documents + chunks + search)
  ├── video: VideoNamespace (rooms, sessions, recordings, conferences, streams)
  ├── logs: LogsNamespace (messages, voice, fax, conferences)
  ├── project: ProjectNamespace (tokens)
  ├── pubsub: PubSubResource
  ├── chat: ChatResource
  └── compat: CompatNamespace (Twilio-compatible, 12 sub-resources)
```

The base class hierarchy:
- `BaseResource` — holds `HttpClient` + base path, provides `_path()` helper
- `CrudResource` — adds `list()`, `create()`, `get()`, `update()`, `delete()` with configurable `_updateMethod` (PATCH or PUT)
- `CrudWithAddresses` — adds `listAddresses()` to CrudResource
