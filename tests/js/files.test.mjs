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

test('save API sends a strong If-Match header and keepalive on page-leave requests', async () => {
  let options;
  const api = createApi('/api', async (url, init) => { options = init; return { ok: true, json: async () => ({ etag: 'next' }) }; });
  await api('/Plan.opml', 'PUT', { document: { rows: [] }, etag: 'prior' }, { keepalive: true });
  assert.equal(options.headers['If-Match'], '"prior"');
  assert.equal(options.keepalive, true);
});

test('API errors carry status so a conflict cannot enter the transient retry loop', async () => {
  const api = createApi('/api', async () => ({ ok: false, status: 412, json: async () => ({ error: 'Conflict' }) }));
  await assert.rejects(api('/Plan.opml', 'PUT', { etag: 'old' }), error => error.status === 412);
});
