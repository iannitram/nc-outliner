import { encodeOutlinePath } from '../../js/file-path.js';
import test from 'node:test';
import assert from 'node:assert/strict';
import { renameDestination, moveDestination, relocateOutline } from '../../js/file-management.js';

test('rename keeps the parent folder and move keeps the filename', () => {
  assert.equal(renameDestination('School/Plan.opml', 'New plan'), 'School/New plan.opml');
  assert.equal(moveDestination('School/Plan.opml', 'Work/2026/'), 'Work/2026/Plan.opml');
  assert.equal(moveDestination('School/Plan.opml', ''), 'Plan.opml');
  for (const path of ['../Bob', '/Files', 'A//B', 'A\\B']) assert.throws(() => moveDestination('Plan.opml', path));
  assert.throws(() => renameDestination('Plan.opml', '../x'));
});

test('relocation flushes local changes and passes the updated ETag', async () => {
  let flushed = false;
  const autosave = { async flush() { flushed = true; }, hasPending: () => false, isConflicted: () => false, getEtag: () => 'fresh' };
  const result = await relocateOutline(async (...args) => {
    assert.equal(flushed, true);
    assert.deepEqual(args, ['/School/Plan.opml/relocate', 'POST', { destination: 'Plan.opml', etag: 'fresh' }]);
    return { name: 'Plan.opml', etag: 'moved' };
  }, { name: 'School/Plan.opml' }, autosave, 'Plan.opml');
  assert.equal(result.etag, 'moved');
});

test('failed saves and conflicts prevent relocation and retain the original name', async () => {
  const current = { name: 'Plan.opml' };
  for (const conflict of [false, true]) {
    const autosave = { flush: async () => false, hasPending: () => !conflict, isConflicted: () => conflict };
    await assert.rejects(relocateOutline(() => assert.fail('must not move'), current, autosave, 'Other.opml'), /Save or resolve/);
    assert.equal(current.name, 'Plan.opml');
  }
});

test('nested URLs preserve slashes and encode spaces and URL punctuation per segment', () => {
  assert.equal(encodeOutlinePath('School notes/Plan #1?.opml'), 'School%20notes/Plan%20%231%3F.opml');
  assert.equal(encodeOutlinePath('School%2Fnotes/Plan.opml'), 'School%252Fnotes/Plan.opml');
});
