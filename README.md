# SignalWire AI Agents SDK for TypeScript

Build AI voice agents as HTTP microservices that serve [SWML](https://developer.signalwire.com/sdks/reference/swml/methods/) documents and handle [SWAIG](https://developer.signalwire.com/sdks/reference/swml/methods/ai/swaig/) function callbacks.

## Quick Start

```bash
npm install
npm run build
```

```typescript
import { AgentBase, SwaigFunctionResult } from 'signalwire-agents';

const agent = new AgentBase({
  name: 'my-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setPromptText('You are a helpful assistant.');

agent.defineTool({
  name: 'get_time',
  description: 'Get the current time',
  parameters: {},
  handler: () => new SwaigFunctionResult(`It is ${new Date().toLocaleTimeString()}`),
});

agent.run(); // Starts HTTP server on port 3000
```

Point your SignalWire phone number's SWML webhook at `http://user:pass@your-host:3000/` and the agent will answer calls.

## How It Works

When a call comes in, SignalWire requests a SWML document from your agent's HTTP endpoint. The SDK builds this document with your configured prompt, tools, languages, and call flow verbs. During the call, the AI can invoke your tools via SWAIG callbacks to the same server.

```
SignalWire ──GET /──> Agent (returns SWML JSON)
SignalWire ──POST /swaig──> Agent (calls your tool handlers)
SignalWire ──POST /post_prompt──> Agent (sends call summary)
```

## Installation

```bash
npm install signalwire-agents
```

Requires Node.js >= 18.

## Core Concepts

### AgentBase

The main class. Each agent is an HTTP server that serves SWML and handles tool callbacks.

```typescript
const agent = new AgentBase({
  name: 'my-agent',        // Agent name (required)
  route: '/',               // HTTP route path
  port: 3000,               // Server port
  basicAuth: ['u', 'p'],    // HTTP basic auth credentials
  autoAnswer: true,         // Auto-answer incoming calls
  recordCall: false,        // Record calls
  recordFormat: 'mp4',      // Recording format
  nativeFunctions: [],      // Platform-native functions (e.g., 'check_time')
});
```

Auth credentials can also be set via environment variables `SWML_BASIC_AUTH_USER` and `SWML_BASIC_AUTH_PASSWORD`. If neither is provided, credentials are auto-generated and logged at startup.

### Tools (SWAIG Functions)

Tools let the AI perform actions during a call. Define them with `defineTool()`:

```typescript
agent.defineTool({
  name: 'lookup_order',
  description: 'Look up an order by ID',
  parameters: {
    order_id: { type: 'string', description: 'The order ID' },
  },
  handler: async (args, fullBody) => {
    const order = await db.findOrder(args.order_id);
    return new SwaigFunctionResult(`Order ${order.id}: status is ${order.status}`);
  },
});
```

Handlers receive the parsed arguments and the full request body. They can be async. The return value must be a `SwaigFunctionResult`.

#### Secure Tools

Mark a tool as `secure: true` to require per-call HMAC tokens:

```typescript
agent.defineTool({
  name: 'charge_card',
  description: 'Charge the customer credit card',
  parameters: { amount: { type: 'string', description: 'Amount to charge' } },
  secure: true,
  handler: (args) => new SwaigFunctionResult(`Charged $${args.amount}`),
});
```

### SwaigFunctionResult

The response builder for tool handlers. Carries response text plus structured platform actions. All methods return `this` for chaining.

```typescript
// Simple response
return new SwaigFunctionResult('Done.');

// Transfer the call
return new SwaigFunctionResult('Transferring you now.')
  .connect('+15551234567');

// Multiple actions
return new SwaigFunctionResult('Noted.')
  .updateGlobalData({ last_action: 'sms' })
  .sendSms({
    toNumber: '+15551234567',
    fromNumber: '+15559876543',
    body: 'Your order has shipped!',
  });

// Hang up
return new SwaigFunctionResult('Goodbye!').hangup();
```

**Available actions:** `connect`, `hangup`, `hold`, `stop`, `waitForUser`, `say`, `playBackgroundFile`, `stopBackgroundFile`, `sendSms`, `recordCall`, `stopRecordCall`, `tap`, `stopTap`, `joinRoom`, `joinConference`, `sipRefer`, `pay`, `executeSwml`, `switchContext`, `swmlChangeStep`, `swmlChangeContext`, `updateGlobalData`, `removeGlobalData`, `setMetadata`, `removeMetadata`, `toggleFunctions`, `simulateUserInput`, `replaceInHistory`, `addDynamicHints`, `clearDynamicHints`, `setEndOfSpeechTimeout`, `executeRpc`, and more.

### Prompts

#### Raw Text

```typescript
agent.setPromptText('You are a helpful assistant.');
```

#### Prompt Object Model (POM)

Build structured prompts with sections, bullets, and subsections:

```typescript
agent.promptAddSection('Role', {
  body: 'You are a customer support agent.',
});

agent.promptAddSection('Rules', {
  bullets: [
    'Always be polite',
    'Never share internal data',
    'Escalate if unsure',
  ],
});

agent.promptAddSection('Guidelines', {
  body: 'Follow these interaction patterns:',
  subsections: [
    { title: 'Greeting', body: 'Always start with a warm greeting.' },
    { title: 'Closing', body: 'Ask if there is anything else before ending.' },
  ],
});
```

You can also append to existing sections:

```typescript
agent.promptAddToSection('Rules', { bullet: 'Keep responses under 2 sentences' });
agent.promptAddSubsection('Guidelines', 'Tone', { body: 'Use a conversational tone.' });
```

### DataMap (Server-Side Tools)

DataMap tools execute on the SignalWire platform without hitting your server. They map API responses to AI-consumable text using templates:

```typescript
import { DataMap, SwaigFunctionResult } from 'signalwire-agents';

const weather = new DataMap('get_weather')
  .purpose('Get weather for a city')
  .parameter('city', 'string', 'City name', { required: true })
  .webhook('GET', 'https://wttr.in/${lc:args.city}?format=j1')
  .output(new SwaigFunctionResult('Weather: ${response.current_condition[0].temp_F}°F'))
  .fallbackOutput(new SwaigFunctionResult('Could not fetch weather.'));

agent.registerSwaigFunction(weather.toSwaigFunction());
```

Or use the helper for simple cases:

```typescript
import { createSimpleApiTool } from 'signalwire-agents';

const joke = createSimpleApiTool({
  name: 'get_joke',
  url: 'https://official-joke-api.appspot.com/random_joke',
  responseTemplate: '${response.setup} ... ${response.punchline}',
});

agent.registerSwaigFunction(joke.toSwaigFunction());
```

### Contexts & Steps

Define multi-step conversation workflows where the AI follows a structured sequence:

```typescript
const ctx = agent.defineContexts();
const flow = ctx.addContext('default');

flow.addStep('greeting', { task: 'Greet the user and ask how you can help.' })
  .setStepCriteria('User has stated their request')
  .setFunctions('none')
  .setValidSteps(['help', 'goodbye']);

flow.addStep('help', { task: 'Help the user with their request.' })
  .setFunctions(['lookup_order', 'check_status'])
  .setValidSteps(['goodbye']);

flow.addStep('goodbye', { task: 'Thank the user and end the call.' })
  .setEnd(true);
```

Steps support gather_info for structured data collection:

```typescript
flow.addStep('collect_info')
  .setText('Collect the caller information.')
  .setGatherInfo({ outputKey: 'caller_info' })
  .addGatherQuestion({ key: 'name', question: 'What is your name?' })
  .addGatherQuestion({ key: 'email', question: 'What is your email?', type: 'string', confirm: true })
  .setValidSteps(['process']);
```

### Call Flow (5-Phase Rendering)

Control what happens at each stage of the call:

```typescript
// Phase 1: Before answering (e.g., play ringing)
agent.addPreAnswerVerb('play', { urls: ['ring:us'], auto_answer: false });

// Phase 2: Answer (automatic if autoAnswer: true)

// Phase 3: After answer, before AI (e.g., welcome message, recording)
agent.addPostAnswerVerb('play', { url: 'say:Welcome!' });

// Phase 4: AI conversation (automatic - built from your prompt, tools, etc.)

// Phase 5: After AI ends (e.g., cleanup)
agent.addPostAiVerb('hangup', {});
```

### AI Configuration

```typescript
// Speech hints for better recognition
agent.addHints(['SignalWire', 'SWML', 'SWAIG']);

// Languages and voices
agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

// Pronunciation corrections
agent.addPronunciation({ replace: 'API', with: 'A P I' });

// LLM parameters
agent.setParam('temperature', 0.7);
agent.setParams({ top_p: 0.9, frequency_penalty: 0.3 });
agent.setPromptLlmParams({ temperature: 0.5 }); // per-prompt params

// Global data accessible to all tools
agent.setGlobalData({ company: 'Acme Corp', plan: 'enterprise' });

// Native platform functions
agent.setNativeFunctions(['check_time']);
```

### Dynamic Configuration

Customize agent behavior per-request based on caller info, query params, or headers:

```typescript
agent.setDynamicConfigCallback(async (queryParams, bodyParams, headers, agentCopy) => {
  const copy = agentCopy as AgentBase;

  // Different prompt based on query param
  if (queryParams['lang'] === 'es') {
    copy.setPromptText('Responde en español.');
    copy.setLanguages([{ name: 'Spanish', code: 'es-ES', voice: 'polly.Lucia' }]);
  }

  // Add caller-specific data
  const callerId = bodyParams['caller_id_number'] as string;
  if (callerId) {
    copy.setGlobalData({ caller_phone: callerId });
  }
});
```

Each request gets an ephemeral copy of the agent, so modifications don't affect other callers.

### Post-Prompt (Call Summaries)

Get a summary after each call:

```typescript
agent.setPostPrompt('Summarize this call as JSON with: topic, resolution, follow_up_needed');
```

Override `onSummary()` in a subclass to process summaries:

```typescript
class MyAgent extends AgentBase {
  async onSummary(summary: Record<string, unknown> | null, rawData: Record<string, unknown>) {
    console.log('Call summary:', summary);
    // Save to database, send notification, etc.
  }
}
```

### Multi-Agent Server

Host multiple agents under a single HTTP server:

```typescript
import { AgentServer, AgentBase } from 'signalwire-agents';

const support = new AgentBase({ name: 'support', route: '/support', basicAuth: ['u', 'p'] });
support.setPromptText('You are a support agent.');

const sales = new AgentBase({ name: 'sales', route: '/sales', basicAuth: ['u', 'p'] });
sales.setPromptText('You are a sales agent.');

const server = new AgentServer({ port: 3000 });
server.register(support);
server.register(sales);
server.run();
```

The root `/` returns a JSON listing of all registered agents. Health checks are at `/health` and `/ready`.

## HTTP Endpoints

Each agent exposes these endpoints:

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/` | GET/POST | Returns SWML document |
| `/swaig` | GET/POST | SWAIG function dispatcher |
| `/post_prompt` | GET/POST | Post-prompt summary handler |
| `/health` | GET | Health check |
| `/ready` | GET | Readiness check |

All endpoints (except health/ready) require basic auth.

## Environment Variables

| Variable | Description |
|----------|-------------|
| `PORT` | Server port (default: 3000) |
| `SWML_BASIC_AUTH_USER` | Basic auth username |
| `SWML_BASIC_AUTH_PASSWORD` | Basic auth password |
| `SWML_PROXY_URL_BASE` | Proxy/tunnel base URL for webhook URLs |

## Documentation

Comprehensive guides and API reference are in the [`docs/`](docs/) directory:

| Guide | Description |
|-------|-------------|
| [Agent Guide](docs/agent-guide.md) | Getting started — creating agents, prompts, tools, call flow, dynamic config |
| [Architecture](docs/architecture.md) | System design, component relationships, SWML rendering pipeline |
| [SWAIG Reference](docs/swaig-reference.md) | Complete SwaigFunctionResult API — all call control, audio, data, and action methods |
| [DataMap Guide](docs/datamap-guide.md) | Server-side tools — webhooks, expressions, templates, environment variables |
| [Contexts & Steps](docs/contexts-guide.md) | Multi-step conversation workflows, navigation, gather_info |
| [Skills Guide](docs/skills-guide.md) | Skills framework — 18 built-in skills, custom skill development |
| [Prefabs Guide](docs/prefabs-guide.md) | Pre-built agents — InfoGatherer, Survey, FAQ, Concierge, Receptionist |
| [CLI Guide](docs/cli-guide.md) | Testing tool — dump SWML, execute tools, simulate serverless |
| [Configuration](docs/configuration.md) | Constructor options, environment variables, ConfigLoader, AuthHandler |
| [Security](docs/security.md) | Authentication, SSL/TLS, CORS, rate limiting, production checklist |
| [Serverless Guide](docs/serverless-guide.md) | Deploy to AWS Lambda, Google Cloud Functions, Azure Functions, CGI |
| [API Reference](docs/api-reference.md) | Complete reference for every exported class, method, and interface |

## Examples

See the [`examples/`](examples/) directory:

- [`simple-agent.ts`](examples/simple-agent.ts) - Minimal agent with a tool
- [`pom-prompt.ts`](examples/pom-prompt.ts) - Structured prompts with POM
- [`datamap-tools.ts`](examples/datamap-tools.ts) - Server-side API tools with DataMap
- [`contexts-steps.ts`](examples/contexts-steps.ts) - Multi-step conversation workflows
- [`multi-agent.ts`](examples/multi-agent.ts) - Multiple agents on one server
- [`dynamic-config.ts`](examples/dynamic-config.ts) - Per-request agent customization
- [`call-flow.ts`](examples/call-flow.ts) - Call flow verbs and recording

Run any example:

```bash
npx tsx examples/simple-agent.ts
```

## Development

```bash
npm run build        # Compile TypeScript
npm test             # Run tests
npm run test:watch   # Watch mode
npm run dev          # Watch + rebuild
```

### Contributing Changes

This project uses [changesets](https://github.com/changesets/changesets) to manage versioning and changelogs. Every pull request that changes runtime behavior must include a changeset.

**Adding a changeset:**

```bash
npx changeset
```

You'll be prompted to:

1. Select the package (`signalwire-agents`)
2. Choose the semver bump type:
   - **patch** — bug fixes, internal changes
   - **minor** — new features, non-breaking additions
   - **major** — breaking API changes
3. Write a short summary of your changes

This creates a markdown file in `.changeset/` that should be committed with your PR. The CI pipeline will fail if a changeset is missing.

**What happens after your PR merges:**

1. A "Release PR" is automatically created (or updated) with the version bump and changelog entry
2. When the team merges the Release PR, the package is published to npm and a GitHub Release is created

## License

MIT
