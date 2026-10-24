import { strict as assert } from 'node:assert';
import test from 'node:test';
import { indentRow, outdentRow, handleIndentKey } from '../../js/indent.js';

const row = (id, children = [], extra = {}) => ({ id, text: id, children, ...extra });
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

test('indent carries the full subtree and preserves unknown metadata', () => {
  const selected = row('b', [row('c')], { note: 'keep', columns: { cost: 3 } });
  const doc = freeze({ title: 'Plan', extensions: { theme: 'custom' }, rows: [row('a', [row('old')], { collapsed: true }), selected, row('d')] });
  const next = indentRow(doc, 'b');
  assert.deepEqual(next.rows.map(r => r.id), ['a', 'd']);
  assert.deepEqual(next.rows[0].children.map(r => r.id), ['old', 'b']);
  assert.equal(next.rows[0].collapsed, false);
  assert.equal(next.rows[0].children[1], selected);
  assert.equal(next.rows[1], doc.rows[2]);
  assert.equal(next.extensions, doc.extensions);
});

test('indent supports nested siblings and leaves unrelated ancestors intact', () => {
  const doc = freeze({ rows: [row('root', [row('a'), row('b', [row('c')])]), row('other')] });
  const next = indentRow(doc, 'b');
  assert.equal(next.rows[0].children[0].children[0], doc.rows[0].children[1]);
  assert.equal(next.rows[1], doc.rows[1]);
});

test('first siblings and unknown IDs cannot indent', () => {
  const doc = freeze({ rows: [row('a', [row('b')]), row('c')] });
  for (const id of ['a', 'b', 'missing']) assert.equal(indentRow(doc, id), doc);
  assert.equal(indentRow({ rows: [] }, 'missing').rows.length, 0);
});

test('outdent places subtree after parent before following parent siblings', () => {
  const selected = row('b', [row('child')], { collapsed: true, style: 'custom' });
  const doc = freeze({ rows: [row('a', [row('first'), selected, row('last')]), row('next')] });
  const next = outdentRow(doc, 'b');
  assert.deepEqual(next.rows.map(r => r.id), ['a', 'b', 'next']);
  assert.deepEqual(next.rows[0].children.map(r => r.id), ['first', 'last']);
  assert.equal(next.rows[1], selected);
  assert.equal(next.rows[2], doc.rows[1]);
});

test('outdent works below root and can leave a parent without children', () => {
  const doc = freeze({ rows: [row('root', [row('a', [row('b')]), row('next')])] });
  const next = outdentRow(doc, 'b');
  assert.deepEqual(next.rows[0].children.map(r => r.id), ['a', 'b', 'next']);
  assert.deepEqual(next.rows[0].children[0].children, []);
});

test('root rows and missing IDs cannot outdent', () => {
  const doc = freeze({ rows: [row('a'), row('b')] });
  for (const id of ['a', 'b', 'missing']) assert.equal(outdentRow(doc, id), doc);
});

test('Tab handler preserves selected row, caret range and selection direction', () => {
  const doc = freeze({ rows: [row('a'), row('b')] });
  let change;
  const context = { getDocument: () => doc, change: (mutator, meta) => { change = { next: mutator(doc), meta }; } };
  const event = { key: 'Tab', target: { dataset: { rowId: 'b' }, selectionStart: 1, selectionEnd: 3, selectionDirection: 'backward' } };
  assert.equal(handleIndentKey(event, context), true);
  assert.equal(change.next.rows[0].children[0].id, 'b');
  assert.deepEqual(change.meta.focus, { id: 'b', offset: 1, end: 3, direction: 'backward' });
  assert.equal(change.meta.kind, 'indent');
});

test('Shift+Tab handler lifts row; boundaries consume Tab without changing history', () => {
  const doc = freeze({ rows: [row('a', [row('b')])] });
  const changes = [];
  const context = { getDocument: () => doc, change: (mutator, meta) => changes.push({ next: mutator(doc), meta }) };
  assert.equal(handleIndentKey({ key: 'Tab', shiftKey: true, target: { dataset: { rowId: 'b' } } }, context), true);
  assert.deepEqual(changes[0].next.rows.map(r => r.id), ['a', 'b']);
  assert.equal(changes[0].meta.kind, 'outdent');
  assert.equal(handleIndentKey({ key: 'Tab', target: { dataset: { rowId: 'a' } } }, context), true);
  assert.equal(changes.length, 1);
});

test('handler leaves other keys, shortcuts, composition and non-row targets alone', () => {
  const context = { getDocument: () => { throw Error('must not edit'); } };
  const event = { key: 'Tab', target: { dataset: { rowId: 'b' } } };
  for (const override of [{ key: 'Enter' }, { isComposing: true }, { ctrlKey: true }, { metaKey: true }, { altKey: true }, { target: {} }]) {
    assert.equal(handleIndentKey({ ...event, ...override }, context), false);
  }
});
