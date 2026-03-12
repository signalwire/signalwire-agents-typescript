# SignalWire RELAY Client

Real-time call control and messaging over WebSocket using TypeScript. The RELAY client connects to SignalWire via the Blade protocol (JSON-RPC 2.0 over WebSocket) and gives you imperative control over live phone calls and SMS/MMS messaging.

## Quick Start

```typescript
import { RelayClient, Call } from 'signalwire-agents';

const client = new RelayClient({
  contexts: ['default'],
});

client.onCall(async (call: Call) => {
  await call.answer();
  const action = await call.play([
    { type: 'tts', text: 'Welcome to SignalWire!' },
  ]);
  await action.wait();
  await call.hangup();
});

client.run();
```

## Features

- Auto-reconnect with exponential backoff
- All 40+ calling methods: play, record, collect, connect, detect, tap, stream, AI, and more
- SMS/MMS messaging: send outbound messages, receive inbound messages, track delivery state
- Action objects with `wait()`, `stop()`, `pause()`, `resume()` for controllable operations
- Typed event classes for all call events
- JWT and legacy authentication
- Dynamic context subscription/unsubscription

## Documentation

- [Getting Started](docs/guide.md) — installation, configuration, first call

## Examples

- [relay-inbound.ts](examples/relay-inbound.ts) — answer an inbound call, play TTS, collect digits
- [relay-outbound.ts](examples/relay-outbound.ts) — dial outbound, detect answering machine, play message
- [relay-messaging.ts](examples/relay-messaging.ts) — send SMS, track delivery, receive inbound messages

## Environment Variables

| Variable | Description |
|----------|-------------|
| `SIGNALWIRE_PROJECT_ID` | Project ID for authentication |
| `SIGNALWIRE_TOKEN` | API token for authentication |
| `SIGNALWIRE_JWT_TOKEN` | JWT token (alternative to project/token) |
| `SIGNALWIRE_SPACE` | Space hostname (default: `relay.signalwire.com`) |
| `SIGNALWIRE_LOG_LEVEL` | Log level (`debug` for WebSocket traffic) |

## Module Structure

```
src/relay/
    index.ts         # Public exports
    RelayClient.ts   # WebSocket connection, auth, event dispatch, reconnect
    Call.ts          # Call object — 40+ calling methods and Action tracking
    Action.ts        # Base Action + 11 subclasses (Play, Record, Detect, etc.)
    Message.ts       # SMS/MMS message tracking with Deferred-based wait()
    RelayEvent.ts    # Base + 22 typed event subclasses, parseEvent() dispatcher
    Deferred.ts      # Promise wrapper for async correlation
    RelayError.ts    # Typed error class with code field
    constants.ts     # Protocol constants, call states, event types
    types.ts         # TypeScript interfaces
```
