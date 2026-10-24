import test from 'node:test';
import assert from 'node:assert/strict';
import { visibleRows, setCollapsed, disclosureAction, createCollapseExtension } from '../../js/collapse.js';

function fixture() {
  return { title: 'Tree', metadata: { author: 'A' }, rows: [
    { id: 'a', text: 'Parent', custom: { color: 'red' }, children: [
      { id: 'b', text: 'Child', collapsed: true, children: [{ id: 'c', text: 'Grandchild', children: [] }] },
      { id: 'd', text: 'Sibling', children: [] },
    ] },
    { id: 'e', text: 'Root sibling', children: [] },
  ] };
}

test('visible preorder hides descendants while preserving depth and parents', () => {
  const doc = fixture();
  assert.deepEqual(visibleRows(doc.rows).map(({ row, parentId, depth }) => [row.id, parentId, depth]), [
    ['a', null, 0], ['b', 'a', 1], ['d', 'a', 1], ['e', null, 0],
  ]);
  assert.deepEqual(visibleRows(setCollapsed(doc, 'a', true).rows).map(({ row }) => row.id), ['a', 'e']);
});

test('collapse and reopen retain descendants, nested collapsed state and unknown data', () => {
  const doc = fixture();
  const collapsed = setCollapsed(doc, 'a', true);
  assert.equal(collapsed.rows[0].children, doc.rows[0].children);
  assert.equal(collapsed.rows[0].custom, doc.rows[0].custom);
  assert.equal(collapsed.metadata, doc.metadata);
  assert.equal(doc.rows[0].collapsed, undefined);
  const expanded = setCollapsed(collapsed, 'a', false);
  assert.equal(expanded.rows[0].children[0].collapsed, true);
  assert.equal(expanded.rows[0].children[0].children[0].id, 'c');
});

test('unknown rows, leaves and unchanged state are no-op document identities', () => {
  const doc = fixture();
  for (const [id, state] of [['missing', true], ['e', true], ['b', true], ['a', false]]) {
    assert.equal(setCollapsed(doc, id, state), doc);
  }
});

test('nested expansion clones only ancestor path and keeps siblings', () => {
  const doc = fixture();
  const next = setCollapsed(doc, 'b', false);
  assert.notEqual(next.rows[0], doc.rows[0]);
  assert.notEqual(next.rows[0].children[0], doc.rows[0].children[0]);
  assert.equal(next.rows[0].children[1], doc.rows[0].children[1]);
  assert.equal(next.rows[1], doc.rows[1]);
});

test('disclosure arrows expand, collapse, focus child and parent at text boundaries', () => {
  const doc = fixture();
  assert.deepEqual(disclosureAction(doc, 'a', 'ArrowLeft', 0, 0, 6), { id: 'a', collapsed: true });
  assert.deepEqual(disclosureAction(doc, 'b', 'ArrowRight', 5, 5, 5), { id: 'b', collapsed: false });
  assert.deepEqual(disclosureAction(doc, 'a', 'ArrowRight', 6, 6, 6), { focus: 'b', offset: 0 });
  assert.deepEqual(disclosureAction(doc, 'b', 'ArrowLeft', 0, 0, 5), { focus: 'a', offset: 6 });
});

test('interior caret, range selections, root and leaf boundaries retain browser defaults', () => {
  const doc = fixture();
  for (const args of [
    ['a', 'ArrowLeft', 2, 2, 6], ['a', 'ArrowRight', 2, 2, 6],
    ['a', 'ArrowLeft', 0, 3, 6], ['e', 'ArrowRight', 12, 12, 12],
    ['e', 'ArrowLeft', 0, 0, 12], ['missing', 'ArrowLeft', 0, 0, 0],
  ]) assert.equal(disclosureAction(doc, ...args), null);
});

test('keyboard hook routes mutations through editor change and ignores IME and modifiers', () => {
  let doc = fixture();
  let prevented = false;
  let meta;
  const event = { key: 'ArrowLeft', target: { dataset: { rowId: 'a' }, value: 'Parent', selectionStart: 0, selectionEnd: 0 }, preventDefault() { prevented = true; } };
  const context = { getDocument: () => doc, change(fn, options) { doc = fn(doc); meta = options; } };
  const hooks = createCollapseExtension();
  assert.equal(hooks.onKeyDown({ ...event, isComposing: true }, context), false);
  assert.equal(hooks.onKeyDown({ ...event, ctrlKey: true }, context), false);
  assert.equal(hooks.onKeyDown(event, context), true);
  assert.equal(prevented, true);
  assert.equal(doc.rows[0].collapsed, true);
  assert.deepEqual(meta.focus, { id: 'a', offset: 0 });
  assert.equal(hooks.shouldRenderChildren(doc.rows[0]), false);
});

test('disclosure decoration is an accessible button for parents and a decorative leaf bullet', () => {
  const hooks = createCollapseExtension();
  function decorate(row) {
    let element;
    const li = { classList: { add() {} }, ownerDocument: { createElement(tag) { return { tag, attrs: {}, listeners: {}, setAttribute(k, v) { this.attrs[k] = v; }, addEventListener(k, fn) { this.listeners[k] = fn; } }; } }, insertBefore(el) { element = el; } };
    hooks.renderRow(row, li, {});
    return element;
  }
  const doc = fixture();
  const parent = decorate(doc.rows[0]);
  assert.equal(parent.tag, 'button');
  assert.equal(parent.attrs['aria-expanded'], 'true');
  assert.equal(parent.attrs['aria-label'], 'Collapse row');
  const collapsed = decorate(doc.rows[0].children[0]);
  assert.equal(collapsed.attrs['aria-expanded'], 'false');
  const leaf = decorate(doc.rows[1]);
  assert.equal(leaf.tag, 'span');
  assert.equal(leaf.textContent, '•');
  assert.equal(leaf.attrs['aria-hidden'], 'true');
});
