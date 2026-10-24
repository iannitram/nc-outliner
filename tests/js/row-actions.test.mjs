import test from 'node:test';
import assert from 'node:assert/strict';
import { deleteRow, moveRow, handleRowActionKey } from '../../js/row-actions.js';

const row = (id, children = []) => ({ id, text: id.toUpperCase(), children, custom: { id } });
const fixture = () => ({ title: 'Plan', metadata: { author: 'Owner' }, rows: [row('a', [row('b', [row('c')]), row('d')]), row('e')] });

test('explicit delete removes complete subtree and preserves metadata and original document', () => {
  const original = fixture();
  const result = deleteRow(original, 'b');
  assert.deepEqual(result.document.rows[0].children.map(r => r.id), ['d']);
  assert.deepEqual(result.focus, { id: 'a', offset: 1 });
  assert.deepEqual(result.document.metadata, original.metadata);
  assert.deepEqual(original.rows[0].children[0].children[0].id, 'c');
});

test('deleting the first root skips its removed descendants when focusing next row', () => {
  const result = deleteRow(fixture(), 'a');
  assert.deepEqual(result.document.rows.map(r => r.id), ['e']);
  assert.deepEqual(result.focus, { id: 'e', offset: 0 });
});

test('deleting after collapsed row focuses visible parent rather than hidden descendants', () => {
  const original = fixture(); original.rows[0].collapsed = true;
  const result = deleteRow(original, 'e');
  assert.deepEqual(result.focus, { id: 'a', offset: 1 });
  assert.equal(deleteRow(original, 'b').document, original);
});

test('deleting final subtree leaves one new editable row', () => {
  const original = fixture(); original.rows.pop();
  const result = deleteRow(original, 'a');
  assert.equal(result.document.rows.length, 1);
  assert.equal(result.document.rows[0].text, '');
  assert.deepEqual(result.document.rows[0].children, []);
  assert.equal(result.focus.id, result.document.rows[0].id);
});

test('moving nested siblings keeps descendants and levels and does not mutate input', () => {
  const original = fixture();
  const next = moveRow(original, 'b', 1);
  assert.deepEqual(next.rows[0].children.map(r => r.id), ['d', 'b']);
  assert.deepEqual(next.rows[0].children[1].children[0], original.rows[0].children[0].children[0]);
  assert.deepEqual(next.rows[0].children[1].custom, { id: 'b' });
  assert.deepEqual(original.rows[0].children.map(r => r.id), ['b', 'd']);
  assert.deepEqual(moveRow(next, 'b', -1), original);
});

test('missing rows and sibling boundaries remain no-op identities', () => {
  const original = fixture();
  for (const [id, dir] of [['a', -1], ['e', 1], ['b', -1], ['missing', 1], ['a', 0]]) assert.equal(moveRow(original, id, dir), original);
  assert.equal(deleteRow(original, 'missing').document, original);
});

test('row shortcuts guard modifiers and IME, retain caret range, and use common change', () => {
  let document = fixture(); let meta;
  const selection = { id: 'b', offset: 0, end: 1, direction: 'backward' };
  const context = { getDocument: () => document, getSelection: () => selection, change(update, data) { document = update(document); meta = data; } };
  const event = { key: 'ArrowDown', altKey: true, target: { dataset: { rowId: 'b' } } };
  for (const changes of [{ altKey: false }, { shiftKey: true }, { ctrlKey: true }, { metaKey: true }, { isComposing: true }, { key: 'Backspace' }, { key: 'Delete', altKey: false }]) {
    assert.equal(handleRowActionKey({ ...event, ...changes }, context), false);
  }
  assert.equal(handleRowActionKey(event, context), true);
  assert.deepEqual(document.rows[0].children.map(r => r.id), ['d', 'b']);
  assert.deepEqual(meta.focus, selection);
  assert.equal(handleRowActionKey({ ...event, key: 'Delete' }, context), true);
  assert.deepEqual(document.rows[0].children.map(r => r.id), ['d']);
  assert.equal(meta.type, 'delete-row');
});
