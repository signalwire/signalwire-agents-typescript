/**
 * Dynamic SWML Service Example
 *
 * Uses SWMLService with an onRequest callback to generate different
 * SWML per request based on query parameters (e.g., ?action=voicemail).
 * Run: npx tsx examples/dynamic-swml-service.ts
 */

import { SWMLService, SwmlBuilder } from '../src/index.js';

export const agent = new SWMLService({
  name: 'dynamic-ivr',
  route: '/',
  basicAuth: ['user', 'pass'],
});

agent.setOnRequestCallback((queryParams, _bodyParams, _headers) => {
  const builder = new SwmlBuilder();
  const action = queryParams['action'] ?? 'greeting';

  builder.addVerb('answer', { max_duration: 300 });

  switch (action) {
    case 'voicemail':
      builder.addVerb('play', {
        url: 'say:Please leave your message after the beep. Press pound when finished.',
      });
      builder.addVerb('record', {
        stereo: true,
        format: 'mp3',
        terminators: '#',
        beep: true,
      });
      builder.addVerb('play', { url: 'say:Message recorded. Goodbye!' });
      break;

    case 'hours':
      builder.addVerb('play', {
        url: 'say:Our business hours are Monday through Friday, 9 AM to 5 PM Eastern Time. Thank you for calling!',
      });
      break;

    case 'transfer':
      builder.addVerb('play', {
        url: 'say:Please hold while we transfer your call.',
      });
      builder.addVerb('connect', {
        from: '+15551234567',
        to: '+18005551234',
      });
      break;

    default:
      builder.addVerb('play', {
        url: 'say:Thank you for calling Acme Corp. For voicemail, add action=voicemail to your request. For business hours, add action=hours.',
      });
      break;
  }

  builder.addVerb('hangup', {});
  return builder;
});

agent.run();
