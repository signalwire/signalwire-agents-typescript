import { HttpClient } from '../../src/rest/HttpClient.js';
import { RestError } from '../../src/rest/RestError.js';
import { mockClientOptions } from './helpers.js';

describe('HttpClient', () => {
  it('sends Basic Auth header', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { ok: true } },
    ]);
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs).toHaveLength(1);
    const expected = 'Basic ' + Buffer.from('test-project:test-token').toString('base64');
    expect(reqs[0].headers['Authorization']).toBe(expected);
  });

  it('sends Accept and User-Agent headers', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: {} },
    ]);
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs[0].headers['Accept']).toBe('application/json');
    expect(reqs[0].headers['User-Agent']).toContain('signalwire-agents-ts');
  });

  it('sends Content-Type for POST with body', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { id: '123' } },
    ]);
    const http = new HttpClient(options);

    await http.post('/api/test', { name: 'foo' });

    const reqs = getRequests();
    expect(reqs[0].headers['Content-Type']).toBe('application/json');
    expect(reqs[0].body).toEqual({ name: 'foo' });
  });

  it('does not send Content-Type for GET', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: {} },
    ]);
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs[0].headers['Content-Type']).toBeUndefined();
  });

  it('returns parsed JSON on success', async () => {
    const { options } = mockClientOptions([
      { status: 200, body: { data: [1, 2, 3] } },
    ]);
    const http = new HttpClient(options);

    const result = await http.get('/api/test');
    expect(result).toEqual({ data: [1, 2, 3] });
  });

  it('returns empty object on 204', async () => {
    const { options } = mockClientOptions([
      { status: 204, body: undefined },
    ]);
    const http = new HttpClient(options);

    const result = await http.delete('/api/test/123');
    expect(result).toEqual({});
  });

  it('throws RestError on non-2xx', async () => {
    const { options } = mockClientOptions([
      { status: 404, body: { error: 'not found' } },
    ]);
    const http = new HttpClient(options);

    await expect(http.get('/api/test/bad')).rejects.toThrow(RestError);

    try {
      await http.get('/api/test/bad');
    } catch (e) {
      // Second request will get default 200 response from our mock
    }
  });

  it('RestError contains status, body, url, method', async () => {
    const { options } = mockClientOptions([
      { status: 422, body: { errors: ['invalid'] } },
    ]);
    const http = new HttpClient(options);

    try {
      await http.post('/api/test', { bad: true });
      throw new Error('Should have thrown');
    } catch (e) {
      expect(e).toBeInstanceOf(RestError);
      const err = e as RestError;
      expect(err.statusCode).toBe(422);
      expect(err.url).toBe('https://test.signalwire.com/api/test');
      expect(err.method).toBe('POST');
    }
  });

  it('appends query params to URL', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { data: [] } },
    ]);
    const http = new HttpClient(options);

    await http.get('/api/test', { page: 2, limit: 10 });

    const reqs = getRequests();
    expect(reqs[0].url).toContain('page=2');
    expect(reqs[0].url).toContain('limit=10');
  });

  it('skips undefined query params', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: {} },
    ]);
    const http = new HttpClient(options);

    await http.get('/api/test', { page: 1, filter: undefined });

    const reqs = getRequests();
    expect(reqs[0].url).toContain('page=1');
    expect(reqs[0].url).not.toContain('filter');
  });

  it('PUT sends body correctly', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { updated: true } },
    ]);
    const http = new HttpClient(options);

    const result = await http.put('/api/test/123', { name: 'bar' });

    const reqs = getRequests();
    expect(reqs[0].method).toBe('PUT');
    expect(reqs[0].body).toEqual({ name: 'bar' });
    expect(result).toEqual({ updated: true });
  });

  it('PATCH sends body correctly', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { patched: true } },
    ]);
    const http = new HttpClient(options);

    const result = await http.patch('/api/test/123', { name: 'baz' });

    const reqs = getRequests();
    expect(reqs[0].method).toBe('PATCH');
    expect(reqs[0].body).toEqual({ name: 'baz' });
    expect(result).toEqual({ patched: true });
  });

  it('strips trailing slashes from baseUrl', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: {} },
    ]);
    options.baseUrl = 'https://test.signalwire.com///';
    const http = new HttpClient(options);

    await http.get('/api/test');

    const reqs = getRequests();
    expect(reqs[0].url).toBe('https://test.signalwire.com/api/test');
  });

  it('handles absolute URLs (for pagination)', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { data: [1] } },
    ]);
    const http = new HttpClient(options);

    await http.get('https://other.signalwire.com/api/test?page=2');

    const reqs = getRequests();
    expect(reqs[0].url).toBe('https://other.signalwire.com/api/test?page=2');
  });
});
