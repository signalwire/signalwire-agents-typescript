import { HttpClient } from '../../src/rest/HttpClient.js';
import { paginate, paginateAll } from '../../src/rest/pagination.js';
import { mockClientOptions } from './helpers.js';

describe('paginate', () => {
  it('yields items from a single page', async () => {
    const { options } = mockClientOptions([
      { status: 200, body: { data: [{ id: 1 }, { id: 2 }] } },
    ]);
    const http = new HttpClient(options);

    const items: any[] = [];
    for await (const item of paginate(http, '/api/test')) {
      items.push(item);
    }
    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
  });

  it('follows links.next across multiple pages', async () => {
    const { options } = mockClientOptions([
      {
        status: 200,
        body: {
          data: [{ id: 1 }],
          links: { next: 'https://test.signalwire.com/api/test?page=2' },
        },
      },
      {
        status: 200,
        body: {
          data: [{ id: 2 }],
          links: { next: 'https://test.signalwire.com/api/test?page=3' },
        },
      },
      {
        status: 200,
        body: {
          data: [{ id: 3 }],
          links: {},
        },
      },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([{ id: 1 }, { id: 2 }, { id: 3 }]);
  });

  it('follows next_page_uri for LAML-style pagination', async () => {
    const { options } = mockClientOptions([
      {
        status: 200,
        body: {
          calls: [{ sid: 'CA1' }],
          next_page_uri: '/api/laml/2010-04-01/Accounts/xxx/Calls?page=1',
        },
      },
      {
        status: 200,
        body: {
          calls: [{ sid: 'CA2' }],
          next_page_uri: null,
        },
      },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/laml/2010-04-01/Accounts/xxx/Calls', undefined, 'calls');
    expect(items).toEqual([{ sid: 'CA1' }, { sid: 'CA2' }]);
  });

  it('handles empty first page', async () => {
    const { options } = mockClientOptions([
      { status: 200, body: { data: [] } },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([]);
  });

  it('handles missing data key gracefully', async () => {
    const { options } = mockClientOptions([
      { status: 200, body: { other: 'stuff' } },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([]);
  });

  it('supports custom data key', async () => {
    const { options } = mockClientOptions([
      { status: 200, body: { results: [{ name: 'a' }, { name: 'b' }] } },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test', undefined, 'results');
    expect(items).toEqual([{ name: 'a' }, { name: 'b' }]);
  });

  it('passes initial query params', async () => {
    const { options, getRequests } = mockClientOptions([
      { status: 200, body: { data: [{ id: 1 }] } },
    ]);
    const http = new HttpClient(options);

    await paginateAll(http, '/api/test', { page_size: 5 });

    const reqs = getRequests();
    expect(reqs[0].url).toContain('page_size=5');
  });

  it('handles relative links.next', async () => {
    const { options } = mockClientOptions([
      {
        status: 200,
        body: {
          data: [{ id: 1 }],
          links: { next: '/api/test?page=2' },
        },
      },
      {
        status: 200,
        body: { data: [{ id: 2 }] },
      },
    ]);
    const http = new HttpClient(options);

    const items = await paginateAll(http, '/api/test');
    expect(items).toEqual([{ id: 1 }, { id: 2 }]);
  });
});
