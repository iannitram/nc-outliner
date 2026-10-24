import test from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave } from '../../js/autosave.js';

function fixture(save) {
  let nextId = 0;
  const timers = new Map();
  const statuses = [];
  let conflicts = 0;
  const engine = createAutosave({ document: { title: 'Original', rows: [] }, etag: 'v1', save,
    onStatus: s => statuses.push(s), onConflict: () => conflicts++,
    setTimer(fn, delay) { timers.set(++nextId, { fn, delay }); return nextId; },
    clearTimer(id) { timers.delete(id); },
  });
  return { engine, timers, statuses, conflicts: () => conflicts };
}
const doc = title => ({ title, rows: [] });
const tick = () => new Promise(r => setImmediate(r));

test('changes debounce into one latest snapshot and use returned etag for the next save', async () => {
  const calls = [];
  const f = fixture(async (...args) => { calls.push(args); return { etag: `v${calls.length + 1}` }; });
  f.engine.update(doc('First')); f.engine.update(doc('Latest'));
  assert.equal(f.timers.size, 1);
  const job = [...f.timers.values()][0]; assert.equal(job.delay, 1500); job.fn(); await tick();
  assert.equal(calls.length, 1); assert.deepEqual(calls[0][0], doc('Latest')); assert.equal(calls[0][1], 'v1');
  assert.equal(f.engine.hasPending(), false); assert.equal(f.statuses.at(-1), 'Saved');
  f.engine.update(doc('Next')); await f.engine.flush(); assert.equal(calls[1][1], 'v2');
});

test('edits made while saving remain dirty and writes never overlap', async () => {
  let release; const calls = [];
  const f = fixture((...args) => { calls.push(args); return calls.length === 1 ? new Promise(r => { release = r; }) : Promise.resolve({ etag: 'v3' }); });
  f.engine.update(doc('One')); const first = f.engine.flush();
  f.engine.update(doc('Two')); const second = f.engine.flush();
  assert.equal(calls.length, 1); release({ etag: 'v2' });
  await Promise.all([first, second]);
  assert.equal(calls.length, 2); assert.equal(calls[1][1], 'v2'); assert.deepEqual(calls[1][0], doc('Two'));
  assert.equal(f.engine.hasPending(), false);
});

test('temporary failures retain changes and retry without changing the etag', async () => {
  let count = 0; const f = fixture(async (snapshot, etag) => { assert.equal(etag, 'v1'); if (++count === 1) throw new Error('Offline'); return { etag: 'v2' }; });
  f.engine.update(doc('Unsaved')); assert.equal(await f.engine.flush(), false);
  assert.equal(f.engine.hasPending(), true); assert.equal(f.statuses.at(-1), "Can't save (retrying)");
  const job = [...f.timers.values()][0]; assert.equal(job.delay, 3000); job.fn(); await tick();
  assert.equal(count, 2); assert.equal(f.engine.hasPending(), false);
});

test('conflicts stop automatic writes and retain the latest local document for copying', async () => {
  let calls = 0; const f = fixture(async () => { calls++; throw Object.assign(new Error('Conflict'), { status: 412 }); });
  f.engine.update(doc('Mine')); await f.engine.flush();
  f.engine.update(doc('More local edits')); await f.engine.flush();
  assert.equal(calls, 1); assert.equal(f.conflicts(), 1); assert.equal(f.timers.size, 0);
  assert.equal(f.engine.isConflicted(), true); assert.deepEqual(f.engine.getDocument(), doc('More local edits'));
});

test('page-leave flush uses keepalive and drains edits queued behind a running save', async () => {
  let release; const calls = [];
  const f = fixture((...args) => { calls.push(args); return calls.length === 1 ? new Promise(r => { release = r; }) : Promise.resolve({ etag: 'v3' }); });
  f.engine.update(doc('One')); const first = f.engine.flush(); f.engine.update(doc('Two'));
  const leave = f.engine.flush({ keepalive: true }); release({ etag: 'v2' }); await Promise.all([first, leave]);
  assert.equal(calls[1][2].keepalive, true); assert.equal(f.engine.hasPending(), false);
});

test('disposing an outline cancels scheduled writes and completion cannot update another outline status', async () => {
  let release; const f = fixture(() => new Promise(r => { release = r; }));
  f.engine.update(doc('Local')); const flight = f.engine.flush(); f.engine.dispose();
  release({ etag: 'v2' }); await flight;
  assert.equal(f.timers.size, 0); assert.deepEqual(f.statuses, ['Saving', 'Saving']);
  assert.equal(await f.engine.flush(), false);
});
