import { RestError } from '../../src/rest/RestError.js';

describe('RestError', () => {
  it('formats error message from status, body, url, method', () => {
    const err = new RestError(404, 'Not Found', 'https://x.signalwire.com/api/test', 'GET');
    expect(err.message).toBe('GET https://x.signalwire.com/api/test returned 404: Not Found');
    expect(err.statusCode).toBe(404);
    expect(err.body).toBe('Not Found');
    expect(err.url).toBe('https://x.signalwire.com/api/test');
    expect(err.method).toBe('GET');
    expect(err.name).toBe('RestError');
  });

  it('is an instance of Error', () => {
    const err = new RestError(500, 'Internal', '/api/test', 'POST');
    expect(err).toBeInstanceOf(Error);
    expect(err).toBeInstanceOf(RestError);
  });

  it('captures stack trace', () => {
    const err = new RestError(400, 'Bad Request', '/api/test', 'PUT');
    expect(err.stack).toBeDefined();
    expect(err.stack).toContain('RestError');
  });
});
