import test from 'node:test';
import assert from 'node:assert/strict';
import { createApi } from '../../js/app.js';

test('file API scopes requests, sends JSON and same-origin credentials', async () => {
  let observed;
  const api = createApi('/apps/outliner/api', async (...args) => {
    observed = args;
    return { ok: true, json: async () => ({ name: 'Test.opml' }) };
  });
  assert.deepEqual(await api('', 'POST', { name: 'Test.opml' }), { name: 'Test.opml' });
  assert.equal(observed[0], '/apps/outliner/api/outlines');
  assert.equal(observed[1].credentials, 'same-origin');
  assert.deepEqual(JSON.parse(observed[1].body), { name: 'Test.opml' });
});

test('file API surfaces conflict instead of treating failed save as saved', async () => {
  const api = createApi('/api', async () => ({ ok: false, status: 412, json: async () => ({ error: 'Changed elsewhere' }) }));
  await assert.rejects(api('/Test.opml', 'PUT', { etag: 'old' }), /Changed elsewhere/);
});
