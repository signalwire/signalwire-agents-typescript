# RELAY Client Guide

The RELAY client provides real-time call and message control over a persistent WebSocket connection to SignalWire. Unlike the HTTP-based agent model (AgentBase), RELAY gives your application event-driven, bidirectional control of live calls and messages.

## Authentication

```typescript
import { RelayClient } from 'signalwire-agents';

const client = new RelayClient({
  project: 'your-project-id',    // or env: SIGNALWIRE_PROJECT_ID
  token: 'your-api-token',       // or env: SIGNALWIRE_TOKEN
  host: 'your-space.signalwire.com', // or env: SIGNALWIRE_SPACE
  contexts: ['office', 'support'],
});
```

All parameters can be provided via environment variables:
- `SIGNALWIRE_PROJECT_ID` - Your SignalWire project ID
- `SIGNALWIRE_TOKEN` - Your SignalWire API token (or `SIGNALWIRE_JWT_TOKEN` for JWT auth)
- `SIGNALWIRE_SPACE` - Your SignalWire space hostname

## Handling Inbound Calls

```typescript
client.onCall(async (call) => {
  console.log(`Inbound call: ${call.callId}`);

  await call.answer();

  const action = await call.play([
    { type: 'tts', text: 'Hello! Thanks for calling.' },
  ]);
  await action.wait();

  await call.hangup();
});

// Start the client (auto-reconnects)
client.run();
```

## Making Outbound Calls

```typescript
await client.connect();

const call = await client.dial(
  [[{ type: 'phone', to: '+15551234567', from: '+15559876543' }]],
  { dialTimeout: 30_000 },
);

console.log(`Call answered: ${call.callId}`);
await call.play([{ type: 'tts', text: 'Hello from RELAY!' }]);
await call.hangup();
```

### Dial Gotcha

The `calling.dial` RPC response does **not** contain a `call_id` — it only returns `{"code":"200","message":"Dialing"}`. The real `call_id` arrives via a `calling.call.dial` event matched by `tag`. The `dial()` method handles this automatically and returns a fully-initialized `Call` object.

## Call Methods

### Lifecycle
- `call.answer()` - Answer an inbound call
- `call.hangup(reason?)` - End the call
- `call.pass()` - Decline control, return to routing

### Audio Playback
```typescript
const action = await call.play([
  { type: 'tts', text: 'Hello world', language: 'en-US' },
  { type: 'audio', url: 'https://example.com/greeting.mp3' },
  { type: 'silence', duration: 2 },
]);

// Control playback
await action.pause();
await action.resume();
await action.volume(-3);
await action.stop();

// Or wait for completion
const event = await action.wait();
```

### Recording
```typescript
const action = await call.record({ format: 'mp3' });
// ... later
await action.stop();
const event = await action.wait();
console.log(`Recording URL: ${event.url}`);
```

### Input Collection
```typescript
// Play and collect (combined)
const action = await call.playAndCollect(
  [{ type: 'tts', text: 'Enter your PIN:' }],
  { digits: { max: 4, terminators: '#' } },
);
const event = await action.wait();

// Standalone collect (no media)
const collectAction = await call.collect({
  speech: { endSilenceTimeout: 2 },
});
```

### Detection
```typescript
const action = await call.detect(
  { type: 'machine', params: { initial_timeout: 5 } },
  { timeout: 10 },
);
const event = await action.wait();
// DetectAction resolves on first meaningful result (HUMAN, MACHINE, etc.)
```

### Connectivity
- `call.connect(devices, options?)` - Bridge to another endpoint
- `call.disconnect()` - Unbridge a connected call
- `call.transfer(dest)` - Transfer to another app/script
- `call.refer(device, options?)` - SIP REFER transfer

### Other Methods
- `call.sendDigits(digits)` - Send DTMF
- `call.hold()` / `call.unhold()`
- `call.denoise()` / `call.denoiseStop()`
- `call.joinConference(name, options?)` / `call.leaveConference(id)`
- `call.stream(url, options?)` - Stream audio to WebSocket
- `call.tap(tap, device, options?)` - Media interception
- `call.transcribe(options?)` - Start transcription
- `call.pay(connectorUrl, options?)` - Payment collection
- `call.sendFax(document, options?)` / `call.receiveFax(options?)`
- `call.ai(options?)` - Start AI agent session
- `call.queueEnter(name)` / `call.queueLeave(name)`
- `call.echo()` - Echo audio back (testing)

## Actions

Action methods return Action objects that track the operation's lifecycle:

```typescript
const action = await call.play([{ type: 'tts', text: 'Hello' }]);

// Check status
console.log(action.isDone);    // false
console.log(action.completed); // false

// Wait for completion
const event = await action.wait(10_000); // with timeout

// Or fire-and-forget with callback
await call.play(
  [{ type: 'tts', text: 'Background music' }],
  {
    onCompleted: (event) => console.log('Playback finished'),
  },
);
```

### Action Types
| Action | Methods | Terminal States |
|--------|---------|----------------|
| `PlayAction` | stop, pause, resume, volume | finished, error |
| `RecordAction` | stop, pause, resume | finished, no_input |
| `DetectAction` | stop | finished, error (+ first result) |
| `CollectAction` | stop, volume, startInputTimers | finished, error, no_input, no_match |
| `FaxAction` | stop | finished, error |
| `TapAction` | stop | finished |
| `StreamAction` | stop | finished |
| `PayAction` | stop | finished, error |
| `TranscribeAction` | stop | finished |
| `AIAction` | stop | finished, error |

## Event Listening

```typescript
// Listen for specific events on a call
call.on('calling.call.play', (event) => {
  console.log(`Play state: ${event.params.state}`);
});

// Wait for a specific event
const event = await call.waitFor('calling.call.state',
  (e) => e.params.call_state === 'answered',
  10_000, // timeout
);

// Wait for call to end
const endEvent = await call.waitForEnded(60_000);
```

## Messaging

```typescript
// Send SMS
const message = await client.sendMessage({
  to: '+15551234567',
  from: '+15559876543',
  body: 'Hello from RELAY!',
});

// Track delivery
const event = await message.wait(30_000);
console.log(`State: ${message.state}`); // delivered, undelivered, failed

// Receive inbound messages
client.onMessage(async (message) => {
  console.log(`From ${message.fromNumber}: ${message.body}`);
});
```

## Reconnection

The `run()` method handles auto-reconnection with exponential backoff:

```typescript
client.run(); // Blocks, auto-reconnects on disconnect
```

Reconnection behavior:
- Initial delay: 1 second
- Max delay: 30 seconds
- Backoff factor: 2x
- Protocol/authorization state preserved across reconnects
- Queued requests flushed after re-authentication
- SIGINT/SIGTERM triggers clean shutdown

For manual control:
```typescript
await client.connect();
// ... use client
await client.disconnect();
```

## Dynamic Context Subscription

```typescript
await client.connect();

// Subscribe to new contexts at runtime
await client.receive(['sales', 'support']);

// Unsubscribe
await client.unreceive(['sales']);
```

## Error Handling

```typescript
import { RelayError } from 'signalwire-agents';

try {
  await call.answer();
} catch (err) {
  if (err instanceof RelayError) {
    console.error(`RELAY error ${err.code}: ${err.message}`);
  }
}
```

### Call-Gone Handling

When a call ends (404/410 from server), methods return `{}` instead of throwing. Actions are resolved immediately so `await action.wait()` doesn't hang:

```typescript
const action = await call.play([{ type: 'tts', text: 'hello' }]);
// If call ended between play request and response, action.isDone === true
```

## Typed Events

All events are parsed into typed classes:

```typescript
import { CallStateEvent, PlayEvent, parseEvent } from 'signalwire-agents';

call.on('calling.call.state', (event) => {
  const stateEvent = event as CallStateEvent;
  console.log(stateEvent.callState);  // 'answered', 'ended', etc.
  console.log(stateEvent.endReason);  // 'hangup', 'busy', etc.
});
```

22 typed event classes are available for all RELAY event types.

## Environment Variables

| Variable | Purpose |
|----------|---------|
| `SIGNALWIRE_PROJECT_ID` | Project ID for authentication |
| `SIGNALWIRE_TOKEN` | API token for authentication |
| `SIGNALWIRE_JWT_TOKEN` | JWT token (alternative to project/token) |
| `SIGNALWIRE_SPACE` | Space hostname (default: relay.signalwire.com) |
| `SIGNALWIRE_LOG_LEVEL` | Log level: debug, info, warn, error |
| `SIGNALWIRE_LOG_MODE` | Set to "off" to suppress logging |

## Examples

See the `examples/` directory:
- `relay-inbound.ts` - Answer calls, play TTS, collect digits
- `relay-outbound.ts` - Dial outbound, detect machine, play message
- `relay-messaging.ts` - Send/receive SMS
