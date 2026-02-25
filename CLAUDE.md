# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Test Commands

```bash
npm run build          # TypeScript compilation (tsc → dist/)
npm test               # Run all tests (vitest)
npm test -- AgentBase  # Run tests matching a filename
npm test -- -t "renders basic SWML"  # Run tests matching a description
npm run test:watch     # Continuous test mode
npm run dev            # TypeScript watch + rebuild
```

CLI tool for testing agents without a running server:
```bash
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --dump-swml
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --list-tools
npx tsx src/cli/swaig-test.ts examples/simple-agent.ts --exec get_time
```

## Architecture

This SDK builds AI voice agents as HTTP microservices. Agents serve [SWML](https://developer.signalwire.com/sdks/reference/swml/methods/) documents (JSON call-flow instructions) and handle [SWAIG](https://developer.signalwire.com/sdks/reference/swml/methods/ai/swaig/) function callbacks from the SignalWire platform.

### Core Flow

```
SignalWire ──GET /──> AgentBase (returns SWML JSON)
SignalWire ──POST /swaig──> AgentBase (dispatches to tool handlers)
SignalWire ──POST /post_prompt──> AgentBase (receives call summary)
```

### Composition Architecture

`AgentBase` is the central class (~1100 lines). It uses **composition** (not inheritance) to assemble functionality from internal managers:

- **PromptManager** / **PomBuilder** — raw text or structured prompt rendering
- **SwmlBuilder** — assembles the 5-phase SWML document
- **SessionManager** — HMAC token generation/validation for secure tools
- **ContextBuilder** — multi-step conversation workflows (state machine)
- **SkillManager** — loads/unloads skill plugins that inject tools, prompts, and hints
- **Hono App** — HTTP server with basicAuth, CORS, security headers, rate limiting

This differs from the Python SDK which uses 8 mixins. The TS SDK composes everything inside AgentBase.

### SWML 5-Phase Rendering

`renderSwml()` builds the call-flow document in phases:
1. **Pre-answer** — verbs before picking up (e.g., play ringing)
2. **Answer** — auto-answer verb (if enabled)
3. **Post-answer** — verbs after answer, before AI (e.g., welcome message)
4. **AI** — the AI block with prompt, tools, languages, params
5. **Post-AI** — verbs after AI ends (e.g., hangup)

### Key Classes

| Class | Purpose | Size |
|-------|---------|------|
| `AgentBase` | HTTP server, SWML rendering, tool dispatch, dynamic config | ~1100 lines |
| `SwaigFunctionResult` | Fluent response builder with 40+ call-control actions | ~900 lines |
| `ContextBuilder` | Multi-step workflows: Context → Step → GatherInfo | ~800 lines |
| `DataMap` | Server-side tools (webhooks + expressions, no server roundtrip) | ~400 lines |
| `SwaigFunction` | Wraps a tool handler with metadata for SWAIG serialization | ~100 lines |

### Subclassing Pattern

Prefab agents and user agents extend `AgentBase` using three key hooks:

```typescript
class MyAgent extends AgentBase {
  static override PROMPT_SECTIONS = [/* declarative prompt sections */];
  protected override defineTools(): void { /* register tools */ }
  async onSummary(summary, rawData) { /* process call summary */ }
}
```

`defineTools()` is called at the end of the `AgentBase` constructor. Subclasses override it to register their tools after all fields are initialized.

### Builder Pattern

`SwaigFunctionResult`, `DataMap`, `ContextBuilder`, and `PomBuilder` all use fluent chaining (methods return `this`).

## Code Conventions

- **ES Modules** throughout (`"type": "module"` in package.json, `.js` extensions in imports)
- **SWML output keys** use `snake_case` to match the Python SDK and platform expectations
- **TypeScript strict mode** enabled — no implicit any, strict null checks
- All public API surfaces have JSDoc comments
- Tests use vitest with globals enabled (no explicit imports of `describe`/`it`/`expect`)
- Test setup (`tests/setup.ts`) polyfills `globalThis.crypto` for Hono's basicAuth in Node

## Key Environment Variables

| Variable | Purpose |
|----------|---------|
| `PORT` | HTTP server port (default 3000) |
| `SWML_BASIC_AUTH_USER` / `SWML_BASIC_AUTH_PASSWORD` | Auth credentials |
| `SWML_PROXY_URL_BASE` | Proxy/tunnel base URL for webhook URLs |
| `SIGNALWIRE_LOG_LEVEL` | debug, info, warn, error |
| `SIGNALWIRE_LOG_MODE` | Set to "off" to suppress all logging |

## Project Layout

- `src/` — TypeScript source (compiled to `dist/`)
- `src/cli/` — CLI tool for offline agent testing (swaig-test)
- `src/skills/` — Skills framework + 18 built-in skills in `builtin/`
- `src/prefabs/` — 5 pre-built agent types (InfoGatherer, Survey, FAQ, Concierge, Receptionist)
- `tests/` — Vitest test files mirroring src/ structure
- `examples/` — Runnable example agents (`npx tsx examples/simple-agent.ts`)
- `docs/` — Comprehensive markdown documentation (12 guides + API reference)
