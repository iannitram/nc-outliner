import test from 'node:test';
import assert from 'node:assert/strict';
import { dropRow, createDragDrop } from '../../js/drag-drop.js';
const row = (id, children = []) => ({ id, text: id, children, note: 'Keep', custom: { id } });
const fixture = () => ({ metadata: { owner: 'Me' }, rows: [row('a', [row('b')]), row('c'), row('d')] });
test('drop reorders before/after in both directions without changing metadata or descendants', () => {
  const original = fixture();
  const after = dropRow(original, 'a', 'c', 'after');
  assert.deepEqual(after.rows.map(r => r.id), ['c', 'a', 'd']);
  assert.deepEqual(after.rows[1], original.rows[0]);
  assert.deepEqual(after.metadata, original.metadata);
  assert.deepEqual(dropRow(after, 'a', 'c', 'before'), original);
  assert.deepEqual(original.rows.map(r => r.id), ['a', 'c', 'd']);
});
test('drop nests into collapsed row and lifts children to a root boundary', () => {
  const original = fixture(); original.rows[2].collapsed = true;
  const nested = dropRow(original, 'a', 'd', 'inside');
  assert.equal(nested.rows[1].collapsed, false);
  assert.equal(nested.rows[1].children[0].children[0].id, 'b');
  assert.deepEqual(dropRow(original, 'b', 'c', 'after').rows.map(r => r.id), ['a', 'c', 'b', 'd']);
});
test('self, descendant, missing, invalid and already adjacent drops are identities', () => {
  const doc = fixture();
  for (const [a,b,pos] of [['a','a','inside'],['a','b','before'],['a','b','inside'],['x','a','after'],['a','x','inside'],['a','c','before'],['a','c','no']]) assert.equal(dropRow(doc,a,b,pos), doc);
});
function element() {
  return { dataset: {}, children: [], listeners: {}, ownerDocument: { createElement: element }, setAttribute() {},
    addEventListener(type, listener) { this.listeners[type] = listener; },
    appendChild(child) { this.children.push(child); }, insertBefore(child) { this.children.unshift(child); } };
}
test('handle drop uses editor change boundary, preserves focus, rejects external and descendant drops', () => {
  let document = fixture(); const metas = [];
  const root = element();
  const selection = { id: 'a', offset: 1, end: 1 };
  const context = { getDocument: () => document, getSelection: () => selection, change(fn, meta) { document = fn(document); metas.push(meta); } };
  const drag = createDragDrop(root, context);
  const items = document.rows.map(row => { const item = element(); drag.renderRow(row,item); return item; });
  const evt = () => ({ dataTransfer: { setData() {} }, preventDefault() { this.prevented = true; }, stopPropagation() {} });
  const target = items[2].children[1].children[1];
  const external = evt(); target.listeners.drop(external); assert.equal(external.prevented, undefined);
  items[0].children[0].listeners.dragstart(evt());
  const drop = evt(); target.listeners.drop(drop);
  assert.equal(drop.prevented, true); assert.equal(document.rows[1].children[0].id, 'a');
  assert.deepEqual(metas[0].focus, selection); assert.equal(root.dataset.dragging, undefined);
  drag.destroy();
});
test('handle exposes keyboard reorder and nesting through same mutation boundary', () => {
  let document = fixture(); const root = element(); const item = element();
  const drag = createDragDrop(root, { getDocument: () => document, getSelection: () => null, change(fn) { document = fn(document); } });
  drag.renderRow(document.rows[1], item);
  const key = key => item.children[0].listeners.keydown({ key, altKey: true, preventDefault() {} });
  key('ArrowRight'); assert.equal(document.rows[0].children[1].id, 'c');
  key('ArrowLeft'); assert.equal(document.rows[1].id, 'c');
  key('ArrowDown'); assert.equal(document.rows[2].id, 'c');
});
