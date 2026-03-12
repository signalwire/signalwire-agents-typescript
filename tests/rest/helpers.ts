/**
 * Test utilities for REST client tests.
 */

/* eslint-disable @typescript-eslint/no-explicit-any */

interface MockResponse {
  status?: number;
  body?: any;
  headers?: Record<string, string>;
}

interface RecordedRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

/**
 * Create a mock fetch function that records requests and returns canned responses.
 *
 * @param responses - Array of responses to return in order. If exhausted, returns 200 {}.
 * @returns [mockFetch, getRequests] - The mock function and a getter for recorded requests.
 */
export function createMockFetch(responses: MockResponse[] = []): [typeof globalThis.fetch, () => RecordedRequest[]] {
  const requests: RecordedRequest[] = [];
  let responseIndex = 0;

  const mockFetch: typeof globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const url = typeof input === 'string' ? input : input.toString();
    const method = init?.method ?? 'GET';
    const headers: Record<string, string> = {};

    if (init?.headers) {
      if (init.headers instanceof Headers) {
        init.headers.forEach((v, k) => { headers[k] = v; });
      } else if (Array.isArray(init.headers)) {
        for (const [k, v] of init.headers) { headers[k] = v; }
      } else {
        Object.assign(headers, init.headers);
      }
    }

    let body: any = undefined;
    if (init?.body) {
      try {
        body = JSON.parse(init.body as string);
      } catch {
        body = init.body;
      }
    }

    requests.push({ url, method, headers, body });

    const resp = responses[responseIndex] ?? { status: 200, body: {} };
    if (responseIndex < responses.length) responseIndex++;

    const status = resp.status ?? 200;
    const respHeaders = new Headers(resp.headers ?? {});
    if (!respHeaders.has('content-type')) {
      respHeaders.set('content-type', 'application/json');
    }

    // 204 No Content must have null body per spec
    if (status === 204) {
      return new Response(null, { status, statusText: 'No Content', headers: respHeaders });
    }

    const respBody = resp.body !== undefined ? JSON.stringify(resp.body) : '';
    return new Response(respBody, {
      status,
      statusText: 'OK',
      headers: respHeaders,
    });
  };

  return [mockFetch as typeof globalThis.fetch, () => requests];
}

/**
 * Create an HttpClient options object with a mock fetch.
 */
export function mockClientOptions(responses: MockResponse[] = []) {
  const [fetchImpl, getRequests] = createMockFetch(responses);
  return {
    options: {
      baseUrl: 'https://test.signalwire.com',
      project: 'test-project',
      token: 'test-token',
      fetchImpl,
    },
    getRequests,
  };
}
