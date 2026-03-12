# SignalWire REST Client

Typed HTTP client for managing SignalWire resources, controlling live calls, and interacting with every SignalWire API surface from TypeScript. No WebSocket required — just standard HTTP requests with `fetch`.

## Quick Start

```typescript
import { SignalWireClient } from 'signalwire-agents';

const client = new SignalWireClient({
  project: 'your-project-id',
  token: 'your-api-token',
  host: 'example.signalwire.com',
});

// Create an AI agent
const agent = await client.fabric.aiAgents.create({
  name: 'Support Bot',
  prompt: { text: 'You are a helpful support agent.' },
});

// Search for a phone number
const results = await client.phoneNumbers.search({ area_code: '512' });

// Place a call via REST
await client.calling.dial({
  from: '+15559876543',
  to: '+15551234567',
  url: 'https://example.com/call-handler',
});
```

## Features

- Single `SignalWireClient` with namespaced sub-objects for every API
- All 37 calling commands: dial, play, record, collect, detect, tap, stream, AI, transcribe, and more
- Full Fabric API: 17 resource types with CRUD + addresses, tokens, and generic resources
- Datasphere: document management and semantic search
- Video: rooms, sessions, recordings, conferences, tokens, streams
- Compatibility API: full Twilio-compatible LAML surface
- Phone number management, 10DLC registry, MFA, logs, and more
- Zero dependencies — uses built-in `fetch` (Node 18+)
- Injectable `fetchImpl` for testing

## Documentation

- [Getting Started](docs/guide.md) — installation, configuration, namespaces, pagination, error handling

## Examples

- [rest-client.ts](examples/rest-client.ts) — overview: list numbers, agents, rooms, documents, logs
- [rest-manage-resources.ts](examples/rest-manage-resources.ts) — create an AI agent, assign a number, place a call
- [rest-datasphere-search.ts](examples/rest-datasphere-search.ts) — upload a document, semantic search
- [rest-calling-play-and-record.ts](examples/rest-calling-play-and-record.ts) — play, record, transcribe, denoise
- [rest-calling-ivr-and-ai.ts](examples/rest-calling-ivr-and-ai.ts) — IVR, detect, AI, tap, stream, SIP refer
- [rest-compat-laml.ts](examples/rest-compat-laml.ts) — Twilio-compatible LAML migration
- [rest-fabric-swml-and-callflows.ts](examples/rest-fabric-swml-and-callflows.ts) — SWML scripts, call flows, webhooks
- [rest-fabric-subscribers-and-sip.ts](examples/rest-fabric-subscribers-and-sip.ts) — subscribers, SIP endpoints, gateways
- [rest-fabric-conferences-and-routing.ts](examples/rest-fabric-conferences-and-routing.ts) — conferences, cXML, routing, tokens
- [rest-phone-number-management.ts](examples/rest-phone-number-management.ts) — search, purchase, groups, lookup, verified callers
- [rest-queues-mfa-and-recordings.ts](examples/rest-queues-mfa-and-recordings.ts) — queues, recordings, MFA
- [rest-video-rooms.ts](examples/rest-video-rooms.ts) — video rooms, sessions, conferences, streams
- [rest-10dlc-registration.ts](examples/rest-10dlc-registration.ts) — 10DLC brand and campaign registration

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_PROJECT_ID` | Project ID for authentication |
| `SIGNALWIRE_API_TOKEN` | API token for authentication |
| `SIGNALWIRE_SPACE` | Space hostname (e.g. `example.signalwire.com`) |
| `SIGNALWIRE_LOG_LEVEL` | Log level (`debug` for HTTP request details) |

## Module Structure

```
src/rest/
    index.ts             # SignalWireClient + public exports
    HttpClient.ts        # fetch-based HTTP with Basic Auth
    RestError.ts         # Error class: statusCode, body, url, method
    pagination.ts        # paginate<T>() async generator + paginateAll()
    types.ts             # ClientOptions, PaginatedResponse, QueryParams
    base/
        BaseResource.ts      # Abstract base with _http + _path()
        CrudResource.ts      # list/create/get/update/delete with generics
        CrudWithAddresses.ts # CrudResource + listAddresses()
    namespaces/
        fabric.ts        # 17 resource types + generic resources + addresses + tokens
        calling.ts       # 37 command dispatch methods via single POST
        phone-numbers.ts # Search, purchase, update, release
        compat.ts        # Twilio-compatible LAML API (12 sub-resources)
        video.ts         # Rooms, sessions, recordings, conferences, streams
        datasphere.ts    # Documents, search, chunks
        ... and 15 more
```
