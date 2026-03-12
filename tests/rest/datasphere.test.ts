import { HttpClient } from '../../src/rest/HttpClient.js';
import { DatasphereNamespace } from '../../src/rest/namespaces/datasphere.js';
import { mockClientOptions } from './helpers.js';

describe('DatasphereNamespace', () => {
  function setup(responses: any[] = [{ status: 200, body: { data: [] } }]) {
    const { options, getRequests } = mockClientOptions(responses);
    const http = new HttpClient(options);
    const ds = new DatasphereNamespace(http);
    return { ds, getRequests };
  }

  it('lists documents', async () => {
    const { ds, getRequests } = setup();
    await ds.documents.list();
    expect(getRequests()[0].url).toContain('/api/datasphere/documents');
    expect(getRequests()[0].method).toBe('GET');
  });

  it('creates a document', async () => {
    const { ds, getRequests } = setup([{ status: 200, body: { id: 'doc1' } }]);
    await ds.documents.create({ name: 'test', content: 'hello' });
    expect(getRequests()[0].method).toBe('POST');
    expect(getRequests()[0].body).toEqual({ name: 'test', content: 'hello' });
  });

  it('gets a document', async () => {
    const { ds, getRequests } = setup([{ status: 200, body: { id: 'doc1' } }]);
    await ds.documents.get('doc1');
    expect(getRequests()[0].url).toContain('/api/datasphere/documents/doc1');
  });

  it('updates a document', async () => {
    const { ds, getRequests } = setup([{ status: 200, body: { id: 'doc1' } }]);
    await ds.documents.update('doc1', { name: 'updated' });
    expect(getRequests()[0].method).toBe('PATCH');
  });

  it('deletes a document', async () => {
    const { ds, getRequests } = setup([{ status: 204 }]);
    await ds.documents.delete('doc1');
    expect(getRequests()[0].method).toBe('DELETE');
  });

  it('searches documents', async () => {
    const { ds, getRequests } = setup([{ status: 200, body: { results: [] } }]);
    await ds.documents.search({ query: 'test query', count: 5 });
    expect(getRequests()[0].url).toContain('/api/datasphere/documents/search');
    expect(getRequests()[0].method).toBe('POST');
    expect(getRequests()[0].body).toEqual({ query: 'test query', count: 5 });
  });

  it('lists chunks for a document', async () => {
    const { ds, getRequests } = setup();
    await ds.documents.listChunks('doc1');
    expect(getRequests()[0].url).toContain('/api/datasphere/documents/doc1/chunks');
  });

  it('gets a specific chunk', async () => {
    const { ds, getRequests } = setup([{ status: 200, body: { id: 'c1' } }]);
    await ds.documents.getChunk('doc1', 'c1');
    expect(getRequests()[0].url).toContain('/api/datasphere/documents/doc1/chunks/c1');
  });

  it('deletes a specific chunk', async () => {
    const { ds, getRequests } = setup([{ status: 204 }]);
    await ds.documents.deleteChunk('doc1', 'c1');
    expect(getRequests()[0].method).toBe('DELETE');
    expect(getRequests()[0].url).toContain('/api/datasphere/documents/doc1/chunks/c1');
  });
});
