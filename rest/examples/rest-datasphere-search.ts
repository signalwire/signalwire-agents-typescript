/**
 * REST Example: Upload a document to Datasphere and run a semantic search.
 *
 * Prerequisites:
 *   export SIGNALWIRE_PROJECT_ID=your-project-id
 *   export SIGNALWIRE_API_TOKEN=your-api-token
 *   export SIGNALWIRE_SPACE=your-space.signalwire.com
 *
 * Run:
 *   npx tsx rest/examples/rest-datasphere-search.ts
 */

import { SignalWireClient } from '../../src/index.js';

const client = new SignalWireClient();

function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function main() {
  // 1. Upload a document
  console.log('Uploading document to Datasphere...');
  const doc = await client.datasphere.documents.create({
    url: 'https://filesamples.com/samples/document/txt/sample3.txt',
    tags: ['support', 'demo'],
  });
  const docId = doc.id;
  console.log(`  Document created: ${docId} (status: ${doc.status})`);

  // 2. Wait for vectorization to complete
  console.log('\nWaiting for document to be vectorized...');
  let vectorized = false;
  for (let i = 0; i < 30; i++) {
    await sleep(2000);
    const docStatus = await client.datasphere.documents.get(docId);
    const status = docStatus.status ?? 'unknown';
    console.log(`  Poll ${i + 1}: status=${status}`);
    if (status === 'completed') {
      console.log(`  Vectorized! Chunks: ${docStatus.number_of_chunks ?? 0}`);
      vectorized = true;
      break;
    }
    if (status === 'error' || status === 'failed') {
      console.log(`  Document processing failed: ${status}`);
      await client.datasphere.documents.delete(docId);
      return;
    }
  }
  if (!vectorized) {
    console.log('  Timed out waiting for vectorization.');
    await client.datasphere.documents.delete(docId);
    return;
  }

  // 3. List chunks
  console.log(`\nListing chunks for document ${docId}...`);
  const chunks = await client.datasphere.documents.listChunks(docId);
  for (const chunk of (chunks.data ?? []).slice(0, 5)) {
    console.log(`  - Chunk ${chunk.id}: ${(chunk.content ?? '').slice(0, 80)}...`);
  }

  // 4. Semantic search across all documents
  console.log('\nSearching Datasphere...');
  const results = await client.datasphere.documents.search({
    query_string: 'lorem ipsum dolor sit amet',
    count: 3,
  });
  for (const chunk of results.chunks ?? []) {
    console.log(`  - ${(chunk.text ?? '').slice(0, 100)}...`);
  }

  // 5. Clean up
  console.log(`\nDeleting document ${docId}...`);
  await client.datasphere.documents.delete(docId);
  console.log('  Deleted.');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
