import test from 'node:test';
import assert from 'node:assert/strict';
import { setExpanded, visibleSelection, handleExpansionKey } from '../../js/expansion.js';
import { mountEditor } from '../../js/editor.js';

const tree = () => ({ title: 'Plan', custom: { author: 'A' }, rows: [
  { id: 'a', text: 'Parent', children: [
    { id: 'b', text: 'Child', children: [{ id: 'c', text: 'Leaf', custom: 42, children: [] }] },
  ] },
  { id: 'd', text: 'Other', children: [{ id: 'e', text: 'Other leaf', children: [] }] },
] });

test('collapse all changes every branch but retains leaves, IDs and metadata', () => {
  const original = tree();
  const next = setExpanded(original, false);
  assert.equal(next.rows[0].collapsed, true);
  assert.equal(next.rows[0].children[0].collapsed, true);
  assert.equal(next.rows[1].collapsed, true);
  assert.equal(next.rows[0].children[0].children[0], original.rows[0].children[0].children[0]);
  assert.equal(next.custom, original.custom);
  assert.equal(original.rows[0].collapsed, undefined);
  assert.equal(setExpanded(next, false), next);
});

test('expanding all restores every nested branch including hidden descendants', () => {
  const next = setExpanded(setExpanded(tree(), false), true);
  assert.equal(next.rows[0].collapsed, false);
  assert.equal(next.rows[0].children[0].collapsed, false);
  assert.equal(next.rows[1].collapsed, false);
  assert.equal(setExpanded(next, true), next);
});

test('subtree operation is recursive and leaves unrelated branches untouched', () => {
  const original = setExpanded(tree(), false);
  const next = setExpanded(original, true, 'a');
  assert.equal(next.rows[0].collapsed, false);
  assert.equal(next.rows[0].children[0].collapsed, false);
  assert.equal(next.rows[1], original.rows[1]);
  assert.equal(setExpanded(next, true, 'missing'), next);
  assert.equal(setExpanded(next, false, 'c'), next);
});

test('focus moves to the visible ancestor only when its selected descendant is hidden', () => {
  const selection = { id: 'c', offset: 2, end: 4, direction: 'backward' };
  assert.equal(visibleSelection(tree(), selection), selection);
  assert.deepEqual(visibleSelection(setExpanded(tree(), false), selection), { id: 'a', offset: 0, end: 0, direction: 'none' });
  assert.equal(visibleSelection(tree(), null), null);
  assert.equal(visibleSelection(tree(), { id: 'missing' }), null);
});

test('subtree shortcuts ignore IME, non-row targets, and unrelated modifiers', () => {
  for (const extra of [{ isComposing: true }, { ctrlKey: true }, { metaKey: true }, { shiftKey: true }, { altKey: false }, { key: 'ArrowUp' }, { target: {} }]) {
    assert.equal(handleExpansionKey({ key: 'ArrowLeft', altKey: true, target: { dataset: { rowId: 'a' } }, ...extra }, {}), false);
  }
});

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, selectionDirection: 'none', classList: { add() {} } });
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  get firstChild() { return this.children[0]; }
  replaceChildren() { this.children = []; }
  setAttribute(k, v) { this.attributes[k] = v; }
  contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  matches() { return this.tag === 'textarea' && !!this.dataset.rowId; }
  querySelectorAll() { return this.children.flatMap((child) => [...(child.matches() ? [child] : []), ...child.querySelectorAll()]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction) { Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction }); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}

function fixture() {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const el = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(el, tree(), (doc) => changes.push(doc));
  const root = el.children[0];
  const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);
  const button = (text) => descendants(root).find((child) => child.tag === 'button' && child.textContent === text);
  const input = (id) => root.querySelectorAll().find((child) => child.dataset.rowId === id);
  return { dom, root, editor, changes, button, input };
}

test('toolbar collapse all keeps focus visible and undoes all branches in one step', () => {
  const f = fixture();
  f.input('c').focus(); f.input('c').setSelectionRange(1, 3, 'backward');
  f.button('Collapse all').listeners.click();
  assert.equal(f.root.querySelectorAll().length, 2);
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
  assert.equal(f.changes.length, 1);
  f.editor.undo();
  assert.equal(f.root.querySelectorAll().length, 5);
  assert.deepEqual(f.editor.getSelection(), { id: 'c', offset: 1, end: 3, direction: 'backward' });
  assert.equal(f.editor.getHistoryState().canUndo, false);
  f.editor.redo();
  assert.equal(f.root.querySelectorAll().length, 2);
  f.button('Expand all').listeners.click();
  assert.equal(f.root.querySelectorAll().length, 5);
});

test('Alt arrows change the entire selected subtree and retain its caret', () => {
  const f = fixture();
  f.input('a').focus(); f.input('a').setSelectionRange(2, 4, 'backward');
  function key(key) {
    const event = { key, altKey: true, target: f.dom.activeElement, preventDefault() { this.prevented = true; } };
    f.root.listeners.keydown(event);
    assert.equal(event.prevented, true);
  }
  key('ArrowLeft');
  assert.equal(f.editor.getDocument().rows[0].children[0].collapsed, true);
  assert.equal(f.root.querySelectorAll().length, 3);
  assert.deepEqual(f.editor.getSelection(), { id: 'a', offset: 2, end: 4, direction: 'backward' });
  assert.equal(f.button('Expand row completely').attributes['aria-keyshortcuts'], 'Alt+ArrowRight');
  key('ArrowRight');
  assert.equal(f.root.querySelectorAll().length, 5);
  assert.equal(f.editor.getDocument().rows[1].collapsed, undefined);
});

test('keyboard-focused toolbar uses the last row selection; unchanged bulk edits create no history', () => {
  const f = fixture();
  const parent = f.input('b'); parent.focus(); parent.setSelectionRange(1, 1);
  f.root.listeners.focusout({ target: parent });
  f.button('Collapse row completely').focus();
  f.button('Collapse row completely').listeners.click();
  assert.equal(f.editor.getDocument().rows[0].children[0].collapsed, true);
  assert.equal(f.dom.activeElement.dataset.rowId, 'b');
  assert.equal(f.changes.length, 1);
  f.button('Collapse row completely').listeners.click();
  assert.equal(f.changes.length, 1);
  f.editor.undo();
  assert.equal(f.editor.getHistoryState().canUndo, false);
});
