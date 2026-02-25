/**
 * Record Call Example
 *
 * Demonstrates call recording with SwaigFunctionResult actions:
 * recordCall(), stopRecordCall(), and other call-control actions.
 * Run: npx tsx examples/record-call.ts
 */

import { AgentBase, SwaigFunctionResult } from '../src/index.js';

export const agent = new AgentBase({
  name: 'recording-agent',
  route: '/',
  basicAuth: ['user', 'pass'],
  recordCall: true,
  recordFormat: 'mp4',
  recordStereo: true,
});

agent.setPromptText(
  'You are a customer service agent. All calls are recorded for quality assurance. ' +
  'If the caller asks, you can pause or stop the recording.',
);

agent.addLanguage({ name: 'English', code: 'en-US', voice: 'rachel' });

agent.defineTool({
  name: 'start_recording',
  description: 'Start or resume call recording',
  parameters: {},
  handler: () => {
    const result = new SwaigFunctionResult('Recording has been started.');
    result.recordCall({ stereo: true, format: 'mp3' });
    return result;
  },
});

agent.defineTool({
  name: 'stop_recording',
  description: 'Stop call recording when the caller requests it',
  parameters: {},
  handler: () => {
    const result = new SwaigFunctionResult('Recording has been stopped.');
    result.stopRecordCall();
    return result;
  },
});

agent.defineTool({
  name: 'transfer_to_supervisor',
  description: 'Transfer the caller to a supervisor',
  parameters: {
    reason: { type: 'string', description: 'Reason for the transfer' },
  },
  handler: (args) => {
    const result = new SwaigFunctionResult(
      `Transferring you to a supervisor. Reason: ${args.reason}`,
    );
    result.connect('+18005551234');
    return result;
  },
});

agent.run();
