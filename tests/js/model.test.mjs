import test from 'node:test';
import assert from 'node:assert/strict';
import { createRow, findRow, updateText, insertAfter, deleteEmpty } from '../../js/model.js';

const fixture = () => ({ title: 'Plan', extension: { untouched: true }, rows: [
  { id: 'a', text: 'A', style: 'heading', children: [{ id: 'b', text: 'B', children: [] }] },
  { id: 'c', text: '', children: [], columns: { status: true } },
] });

test('editing nested text preserves identities, structure, metadata and original document', () => {
  const original = fixture();
  const next = updateText(original, 'b', 'Changed 🪐');
  assert.equal(findRow(next.rows, 'b').row.text, 'Changed 🪐');
  assert.equal(findRow(original.rows, 'b').row.text, 'B');
  assert.equal(next.rows[0].style, 'heading');
  assert.deepEqual(next.extension, original.extension);
  assert.deepEqual(next.rows[1].columns, { status: true });
});

test('Enter inserts a blank sibling after a nested row and gives it a unique stable ID', () => {
  const original = fixture();
  const { document: next, focus } = insertAfter(original, 'b');
  assert.equal(next.rows[0].children.length, 2);
  assert.equal(next.rows[0].children[1].id, focus.id);
  assert.equal(next.rows[0].children[1].text, '');
  assert.equal(original.rows[0].children.length, 1);
  assert.notEqual(createRow().id, focus.id);
});

test('Backspace on empty row deletes it and focuses previous row at its end', () => {
  const original = fixture();
  const { document: next, focus } = deleteEmpty(original, 'c');
  assert.equal(next.rows.length, 1);
  assert.deepEqual(focus, { id: 'b', offset: 1 });
  assert.equal(original.rows.length, 2);
});

test('deletion never removes nonempty rows, children, or the final editable row', () => {
  const document = fixture();
  assert.equal(deleteEmpty(document, 'a').document, document);
  document.rows[0].text = '';
  assert.equal(deleteEmpty(document, 'a').document, document);
  const single = { rows: [createRow()] };
  assert.equal(deleteEmpty(single, single.rows[0].id).document, single);
});

test('deleting first blank row moves focus to following row start', () => {
  const document = { rows: [{ id: 'x', text: '', children: [] }, { id: 'y', text: 'Next', children: [] }] };
  assert.deepEqual(deleteEmpty(document, 'x').focus, { id: 'y', offset: 0 });
});

test('missing targets and unchanged edits are no-ops', () => {
  const document = fixture();
  assert.equal(updateText(document, 'missing', 'x'), document);
  assert.equal(updateText(document, 'a', 'A'), document);
  assert.equal(insertAfter(document, 'missing').document, document);
  assert.equal(deleteEmpty(document, 'missing').document, document);
});


test('deleting after a collapsed parent focuses its visible row rather than hidden descendants', () => {
  const document = { rows: [
    { id: 'parent', text: 'Parent', collapsed: true, children: [
      { id: 'child', text: 'Hidden', children: [{ id: 'grandchild', text: 'Also hidden', children: [] }] },
    ] },
    { id: 'empty', text: '', children: [] },
  ] };
  const result = deleteEmpty(document, 'empty');
  assert.deepEqual(result.focus, { id: 'parent', offset: 6 });
  assert.equal(result.document.rows.length, 1);
  assert.deepEqual(result.document.rows[0].children, document.rows[0].children);
});
