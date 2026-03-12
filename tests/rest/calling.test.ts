import { HttpClient } from '../../src/rest/HttpClient.js';
import { CallingNamespace } from '../../src/rest/namespaces/calling.js';
import { mockClientOptions } from './helpers.js';

describe('CallingNamespace', () => {
  function setup(responses: any[] = [{ status: 200, body: { result: 'ok' } }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const calling = new CallingNamespace(http);
    return { calling, getRequests };
  }

  it('dial sends command without call_id', async () => {
    const { calling, getRequests } = setup();
    await calling.dial({ to: '+15551234567', from: '+15559876543' });
    const req = getRequests()[0];
    expect(req.method).toBe('POST');
    expect(req.url).toContain('/api/calling/calls');
    expect(req.body).toEqual({
      command: 'dial',
      params: { to: '+15551234567', from: '+15559876543' },
    });
    expect(req.body.id).toBeUndefined();
  });

  it('end sends command with call_id', async () => {
    const { calling, getRequests } = setup();
    await calling.end('call-123', { reason: 'hangup' });
    const req = getRequests()[0];
    expect(req.body).toEqual({
      command: 'calling.end',
      id: 'call-123',
      params: { reason: 'hangup' },
    });
  });

  it('play sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.play('call-123', { url: 'http://example.com/audio.mp3' });
    expect(getRequests()[0].body.command).toBe('calling.play');
  });

  it('playPause sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.playPause('call-123');
    expect(getRequests()[0].body.command).toBe('calling.play.pause');
  });

  it('record sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.record('call-123', { beep: true });
    expect(getRequests()[0].body.command).toBe('calling.record');
    expect(getRequests()[0].body.params).toEqual({ beep: true });
  });

  it('collect sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.collect('call-123', { digits: { max: 4 } });
    expect(getRequests()[0].body.command).toBe('calling.collect');
  });

  it('detect sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.detect('call-123');
    expect(getRequests()[0].body.command).toBe('calling.detect');
  });

  it('tap sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.tap('call-123');
    expect(getRequests()[0].body.command).toBe('calling.tap');
  });

  it('stream sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.stream('call-123');
    expect(getRequests()[0].body.command).toBe('calling.stream');
  });

  it('denoise sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.denoise('call-123');
    expect(getRequests()[0].body.command).toBe('calling.denoise');
  });

  it('transcribe sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.transcribe('call-123');
    expect(getRequests()[0].body.command).toBe('calling.transcribe');
  });

  it('aiMessage sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.aiMessage('call-123', { message: 'hello' });
    expect(getRequests()[0].body.command).toBe('calling.ai_message');
  });

  it('aiStop sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.aiStop('call-123');
    expect(getRequests()[0].body.command).toBe('calling.ai.stop');
  });

  it('liveTranscribe sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.liveTranscribe('call-123');
    expect(getRequests()[0].body.command).toBe('calling.live_transcribe');
  });

  it('refer sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.refer('call-123', { to: 'sip:user@example.com' });
    expect(getRequests()[0].body.command).toBe('calling.refer');
  });

  it('userEvent sends correct command', async () => {
    const { calling, getRequests } = setup();
    await calling.userEvent('call-123', { event_name: 'custom' });
    expect(getRequests()[0].body.command).toBe('calling.user_event');
  });

  it('all stop commands use correct format', async () => {
    const { calling, getRequests } = setup([
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: {} },
      { status: 200, body: {} },
    ]);

    await calling.playStop('c1');
    await calling.recordStop('c1');
    await calling.collectStop('c1');
    await calling.detectStop('c1');
    await calling.tapStop('c1');
    await calling.streamStop('c1');
    await calling.denoiseStop('c1');
    await calling.transcribeStop('c1');
    await calling.sendFaxStop('c1');

    const reqs = getRequests();
    expect(reqs[0].body.command).toBe('calling.play.stop');
    expect(reqs[1].body.command).toBe('calling.record.stop');
    expect(reqs[2].body.command).toBe('calling.collect.stop');
    expect(reqs[3].body.command).toBe('calling.detect.stop');
    expect(reqs[4].body.command).toBe('calling.tap.stop');
    expect(reqs[5].body.command).toBe('calling.stream.stop');
    expect(reqs[6].body.command).toBe('calling.denoise.stop');
    expect(reqs[7].body.command).toBe('calling.transcribe.stop');
    expect(reqs[8].body.command).toBe('calling.send_fax.stop');
  });
});
