#!/usr/bin/env node
/**
 * swaig-test - CLI tool for testing SignalWire AI agents locally.
 *
 * Usage:
 *   swaig-test <agent-path> [options]
 *
 * Actions:
 *   --list-tools       List all SWAIG functions with parameters
 *   --list-agents      List all exported agents in a file
 *   --dump-swml        Generate and output SWML document
 *   --exec <name>      Execute a function (use --arg key=value for args)
 *
 * Options:
 *   --raw              Raw JSON output (suppresses logs)
 *   --verbose          Verbose output
 *   --format-json      Format output as indented JSON
 *   --call-type        sip|webrtc (default: webrtc)
 *   --call-direction   inbound|outbound (default: inbound)
 *   --call-state       active|ringing|hold (default: active)
 *   --call-id          Override call ID
 *   --from-number      Override from number
 *   --to-extension     Override to extension
 *   --arg key=value    Function argument (repeatable)
 *   --override k=v     Override call data field (repeatable)
 *   --agent-class      Name of specific agent class to use
 *   --route            Route for agent (default: /)
 *   --env KEY=VALUE    Set env var (repeatable)
 *   --env-file         Load env vars from file
 *   --simulate-serverless <platform>  Simulate serverless platform
 */

import { loadAgent, listAgents } from './agent-loader.js';
import { generateFakePostData, generateMinimalPostData } from './mock-data.js';
import { suppressAllLogs, setGlobalLogLevel } from '../Logger.js';
import { ServerlessAdapter } from '../ServerlessAdapter.js';
import type { ServerlessPlatform } from '../ServerlessAdapter.js';

interface CliOptions {
  agentPath: string;
  action: 'list-tools' | 'list-agents' | 'dump-swml' | 'exec';
  execName?: string;
  raw: boolean;
  verbose: boolean;
  formatJson: boolean;
  callType: 'sip' | 'webrtc';
  callDirection: 'inbound' | 'outbound';
  callState: string;
  callId?: string;
  fromNumber?: string;
  toExtension?: string;
  args: Record<string, unknown>;
  overrides: Record<string, unknown>;
  agentClass?: string;
  route?: string;
  envVars: Record<string, string>;
  envFile?: string;
  simulateServerless?: string;
}

function printUsage(): void {
  console.log(`
swaig-test - CLI tool for testing SignalWire AI agents locally

Usage:
  swaig-test <agent-path> [options]

Actions:
  --list-tools       List all SWAIG functions with parameters
  --list-agents      List all exported agents in a file
  --dump-swml        Generate and output SWML document
  --exec <name>      Execute a function (use --arg key=value for args)

Options:
  --raw              Raw JSON output (suppresses logs)
  --verbose          Verbose output
  --format-json      Format output as indented JSON
  --call-type        sip|webrtc (default: webrtc)
  --call-direction   inbound|outbound (default: inbound)
  --call-state       active|ringing|hold (default: active)
  --call-id          Override call ID
  --from-number      Override from number
  --to-extension     Override to extension
  --arg key=value    Function argument (repeatable)
  --override k=v     Override call data field (repeatable)
  --agent-class      Name of specific agent class to use
  --route            Route for the agent
  --env KEY=VALUE    Set env var (repeatable)
  --env-file         Load env vars from file
  --simulate-serverless <platform>  Simulate serverless (lambda|gcf|azure|cgi)
  --help             Show this help message
`);
}

function parseArgs(argv: string[]): CliOptions {
  const args = argv.slice(2); // skip node + script
  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    printUsage();
    process.exit(0);
  }

  const opts: CliOptions = {
    agentPath: '',
    action: 'dump-swml',
    raw: false,
    verbose: false,
    formatJson: false,
    callType: 'webrtc',
    callDirection: 'inbound',
    callState: 'active',
    args: {},
    overrides: {},
    envVars: {},
  };

  let i = 0;

  // First positional arg is the agent path
  if (!args[0].startsWith('--')) {
    opts.agentPath = args[0];
    i = 1;
  }

  for (; i < args.length; i++) {
    const arg = args[i];
    switch (arg) {
      case '--list-tools':
        opts.action = 'list-tools';
        break;
      case '--list-agents':
        opts.action = 'list-agents';
        break;
      case '--dump-swml':
        opts.action = 'dump-swml';
        break;
      case '--exec':
        opts.action = 'exec';
        opts.execName = args[++i];
        if (!opts.execName) {
          console.error('Error: --exec requires a function name');
          process.exit(1);
        }
        break;
      case '--raw':
        opts.raw = true;
        break;
      case '--verbose':
        opts.verbose = true;
        break;
      case '--format-json':
        opts.formatJson = true;
        break;
      case '--call-type':
        opts.callType = args[++i] as 'sip' | 'webrtc';
        break;
      case '--call-direction':
        opts.callDirection = args[++i] as 'inbound' | 'outbound';
        break;
      case '--call-state':
        opts.callState = args[++i];
        break;
      case '--call-id':
        opts.callId = args[++i];
        break;
      case '--from-number':
        opts.fromNumber = args[++i];
        break;
      case '--to-extension':
        opts.toExtension = args[++i];
        break;
      case '--agent-class':
        opts.agentClass = args[++i];
        break;
      case '--route':
        opts.route = args[++i];
        break;
      case '--simulate-serverless':
        opts.simulateServerless = args[++i];
        break;
      case '--env-file':
        opts.envFile = args[++i];
        break;
      case '--arg': {
        const kv = args[++i];
        if (!kv || !kv.includes('=')) {
          console.error('Error: --arg requires key=value format');
          process.exit(1);
        }
        const eqIdx = kv.indexOf('=');
        const key = kv.slice(0, eqIdx);
        const val = kv.slice(eqIdx + 1);
        // Try to parse as JSON, fall back to string
        try {
          opts.args[key] = JSON.parse(val);
        } catch {
          opts.args[key] = val;
        }
        break;
      }
      case '--override': {
        const kv = args[++i];
        if (!kv || !kv.includes('=')) {
          console.error('Error: --override requires key=value format');
          process.exit(1);
        }
        const eqIdx = kv.indexOf('=');
        const key = kv.slice(0, eqIdx);
        const val = kv.slice(eqIdx + 1);
        try {
          opts.overrides[key] = JSON.parse(val);
        } catch {
          opts.overrides[key] = val;
        }
        break;
      }
      case '--env': {
        const kv = args[++i];
        if (!kv || !kv.includes('=')) {
          console.error('Error: --env requires KEY=VALUE format');
          process.exit(1);
        }
        const eqIdx = kv.indexOf('=');
        opts.envVars[kv.slice(0, eqIdx)] = kv.slice(eqIdx + 1);
        break;
      }
      default:
        if (!opts.agentPath && !arg.startsWith('--')) {
          opts.agentPath = arg;
        } else {
          console.error(`Unknown option: ${arg}`);
          process.exit(1);
        }
    }
  }

  if (!opts.agentPath) {
    console.error('Error: agent path is required');
    printUsage();
    process.exit(1);
  }

  return opts;
}

function loadEnvFile(filePath: string): void {
  const { readFileSync } = require('node:fs');
  const { resolve } = require('node:path');
  const content = readFileSync(resolve(filePath), 'utf-8');
  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx > 0) {
      const key = trimmed.slice(0, eqIdx).trim();
      let val = trimmed.slice(eqIdx + 1).trim();
      // Strip quotes
      if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
        val = val.slice(1, -1);
      }
      process.env[key] = val;
    }
  }
}

async function main(): Promise<void> {
  const opts = parseArgs(process.argv);

  if (opts.raw) {
    suppressAllLogs(true);
  } else if (opts.verbose) {
    setGlobalLogLevel('debug');
  }

  // Apply env vars
  if (opts.envFile) {
    loadEnvFile(opts.envFile);
  }
  for (const [k, v] of Object.entries(opts.envVars)) {
    process.env[k] = v;
  }

  // List agents action (doesn't need a loaded agent)
  if (opts.action === 'list-agents') {
    const agents = await listAgents(opts.agentPath);
    if (opts.raw || opts.formatJson) {
      console.log(JSON.stringify(agents, null, 2));
    } else {
      console.log(`\nExported agents in ${opts.agentPath}:\n`);
      for (const name of agents) {
        console.log(`  ${name}`);
      }
      console.log();
    }
    return;
  }

  // Load agent
  const agent = await loadAgent(opts.agentPath, opts.agentClass) as any;

  // Apply --route override
  if (opts.route && typeof agent.route !== 'undefined') {
    agent.route = opts.route;
  }

  // Handle --simulate-serverless
  if (opts.simulateServerless) {
    const platform = opts.simulateServerless as ServerlessPlatform;
    const adapter = new ServerlessAdapter(platform);
    const app = agent.getApp();
    const postData = generateFakePostData({
      callType: opts.callType,
      callDirection: opts.callDirection,
      callState: opts.callState,
      callId: opts.callId,
      fromNumber: opts.fromNumber,
      toExtension: opts.toExtension,
      overrides: opts.overrides,
    });
    const event = {
      httpMethod: 'POST',
      path: agent.route ?? '/',
      headers: {
        'content-type': 'application/json',
        'authorization': 'Basic ' + Buffer.from(`${agent.basicAuthCreds?.[0] ?? 'user'}:${agent.basicAuthCreds?.[1] ?? 'pass'}`).toString('base64'),
      },
      body: postData,
    };
    const response = await adapter.handleRequest(app, event);
    if (opts.raw || opts.formatJson) {
      try {
        console.log(JSON.stringify(JSON.parse(response.body), null, 2));
      } catch {
        console.log(response.body);
      }
    } else {
      console.log(`\n--- Serverless Simulation (${platform}) ---`);
      console.log(`Status: ${response.statusCode}`);
      console.log(`Headers: ${JSON.stringify(response.headers, null, 2)}`);
      console.log('Body:');
      try {
        console.log(JSON.stringify(JSON.parse(response.body), null, 2));
      } catch {
        console.log(response.body);
      }
      console.log();
    }
    return;
  }

  switch (opts.action) {
    case 'list-tools': {
      if (typeof agent.getRegisteredTools !== 'function') {
        console.log('This is a SWMLService (no tools). Use --dump-swml to see the SWML document.');
        break;
      }
      const tools = agent.getRegisteredTools();
      if (opts.raw || opts.formatJson) {
        console.log(JSON.stringify(tools, null, 2));
      } else {
        if (tools.length === 0) {
          console.log('No tools registered.');
        } else {
          console.log(`\nRegistered tools (${tools.length}):\n`);
          for (const tool of tools) {
            console.log(`  ${tool.name}`);
            console.log(`    Description: ${tool.description}`);
            if (tool.parameters && Object.keys(tool.parameters).length) {
              console.log(`    Parameters: ${JSON.stringify(tool.parameters, null, 6).replace(/\n/g, '\n    ')}`);
            }
            console.log();
          }
        }
      }
      break;
    }

    case 'dump-swml': {
      // SWMLService.renderSwml() returns an object; AgentBase.renderSwml() returns a string
      let swmlJson: unknown;
      if (typeof agent.getRegisteredTools !== 'function') {
        // SWMLService — renderSwml returns object directly
        swmlJson = agent.renderSwml();
      } else {
        // AgentBase — renderSwml(callId) returns JSON string
        const postData = generateFakePostData({
          callType: opts.callType,
          callDirection: opts.callDirection,
          callState: opts.callState,
          callId: opts.callId,
          fromNumber: opts.fromNumber,
          toExtension: opts.toExtension,
          overrides: opts.overrides,
        });
        swmlJson = JSON.parse(agent.renderSwml(postData['call_id'] as string));
      }
      if (opts.raw || opts.formatJson) {
        console.log(JSON.stringify(swmlJson, null, 2));
      } else {
        console.log('\n--- SWML Document ---\n');
        console.log(JSON.stringify(swmlJson, null, 2));
        console.log();
      }
      break;
    }

    case 'exec': {
      if (!opts.execName) {
        console.error('Error: --exec requires a function name');
        process.exit(1);
      }

      const tool = agent.getTool(opts.execName);
      if (!tool) {
        console.error(`Error: function '${opts.execName}' not found`);
        const available = agent.getRegisteredTools().map((t: any) => t.name);
        if (available.length) {
          console.error(`Available functions: ${available.join(', ')}`);
        }
        process.exit(1);
      }

      const postData = generateMinimalPostData(opts.execName, opts.args, {
        callId: opts.callId,
        overrides: opts.overrides,
      });

      if (!opts.raw) {
        console.log(`\nExecuting: ${opts.execName}`);
        if (Object.keys(opts.args).length) {
          console.log(`Arguments: ${JSON.stringify(opts.args)}`);
        }
        console.log();
      }

      const result = await tool.execute(opts.args, postData);

      if (opts.raw || opts.formatJson) {
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log('--- Result ---\n');
        console.log(JSON.stringify(result, null, 2));
        console.log();
      }
      break;
    }
  }
}

main().catch((err) => {
  console.error(err.message ?? err);
  process.exit(1);
});
