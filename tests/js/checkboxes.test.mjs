import test from 'node:test';
import assert from 'node:assert/strict';
import { checkboxState, setCheckboxVisibility, setRowChecked } from '../../js/checkboxes.js';
import { mountEditor } from '../../js/editor.js';

const documentFixture = () => ({ title: 'Tasks', custom: { author: 'A' }, rows: [{ id: 'a', text: 'Parent', checked: true, children: [{ id: 'b', text: 'Child', custom: { color: 'red' }, children: [] }] }] });

test('hide/show preserves all checked state and extension data without mutating source', () => {
  const doc = documentFixture();
  const visible = setCheckboxVisibility(doc, true);
  const hidden = setCheckboxVisibility(visible, false);
  assert.equal(visible.rows, doc.rows);
  assert.equal(hidden.rows[0].checked, true);
  assert.equal(hidden.custom, doc.custom);
  assert.equal(doc.showCheckboxes, undefined);
  assert.equal(setCheckboxVisibility(hidden, false), hidden);
});

test('checking a nested row preserves identities, ancestors, and unknown metadata', () => {
  const doc = documentFixture();
  const next = setRowChecked(doc, 'b', true);
  assert.equal(next.rows[0].children[0].checked, true);
  assert.equal(next.rows[0].checked, true);
  assert.equal(next.rows[0].children[0].custom, doc.rows[0].children[0].custom);
  assert.equal(doc.rows[0].children[0].checked, undefined);
  assert.equal(setRowChecked(next, 'b', true), next);
  assert.equal(setRowChecked(next, 'missing', false), next);
});

class Element {
  constructor(tag, ownerDocument) { Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, classList: { add() {} } }); }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  get firstChild() { return this.children[0]; }
  replaceChildren() { this.children = []; }
  setAttribute(k, v) { this.attributes[k] = v; }
  contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  matches() { return this.tag === 'textarea' && Boolean(this.dataset.rowId); }
  querySelectorAll() { return this.children.flatMap((child) => [...(child.matches() ? [child] : []), ...child.querySelectorAll()]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end) { Object.assign(this, { selectionStart: start, selectionEnd: end }); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}
const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);

test('default editor checklist controls notify persistence and undo/redo visibility and nested status', () => {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const host = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(host, documentFixture(), (next) => changes.push(next));
  const controls = () => descendants(host);
  const toggle = () => controls().find((el) => el.textContent === 'Show checkboxes' || el.textContent === 'Hide checkboxes');
  const checks = () => controls().filter((el) => el.type === 'checkbox');
  assert.equal(checks().length, 0);
  toggle().listeners.click();
  assert.equal(toggle().attributes['aria-pressed'], 'true');
  assert.equal(checks().length, 2);
  assert.equal(checks()[0].checked, false);
  assert.equal(checks()[1].attributes['aria-label'], 'Mark Child complete');
  checks()[1].checked = true;
  checks()[1].listeners.change();
  assert.equal(editor.getDocument().rows[0].children[0].checked, true);
  editor.undo();
  assert.equal(checks()[1].checked, false);
  editor.redo();
  assert.equal(checks()[1].checked, true);
  toggle().listeners.click();
  assert.equal(checks().length, 0);
  assert.equal(editor.getDocument().rows[0].children[0].checked, true);
  editor.undo();
  assert.equal(checks()[1].checked, true);
  assert.equal(changes.length, 6);
});


test('calculated states aggregate recursively and subtree toggles preserve unrelated rows', () => {
  const leaf = (id, checked) => ({ id, checked, children: [], custom: { id } });
  const branch = { id: 'branch', collapsed: true, checked: true, children: [leaf('one', true), leaf('two', false)] };
  const parent = { id: 'root', children: [branch, leaf('three', false)] };
  const doc = { showCheckboxes: true, rows: [parent, leaf('outside', false)] };
  assert.equal(checkboxState(parent), 'mixed');
  const checked = setRowChecked(doc, 'root', true);
  assert.equal(checkboxState(checked.rows[0]), 'checked');
  assert.equal(checked.rows[0].children[0].children[1].checked, true);
  assert.equal(checked.rows[1], doc.rows[1]);
  assert.equal(parent.children[0].children[1].checked, false);
  assert.equal(checked.rows[0].children[0].children[1].custom, branch.children[1].custom);
  assert.equal(setRowChecked(checked, 'root', true), checked);
  assert.equal(checkboxState(setRowChecked(checked, 'root', false).rows[0]), 'unchecked');
  assert.equal(checkboxState(setRowChecked(checked, 'two', false).rows[0]), 'mixed');
});

test('mixed parent UI checks all descendants with one history/persistence edit and restores mixed on undo', () => {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const host = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(host, { showCheckboxes: true, rows: [{ id: 'a', text: 'Parent', collapsed: true, children: [
    { id: 'b', text: 'One', checked: true, children: [] }, { id: 'c', text: 'Two', children: [] },
  ] }] }, (next) => changes.push(next));
  const parent = () => descendants(host).find((el) => el.type === 'checkbox');
  assert.equal(parent().indeterminate, true);
  assert.equal(parent().attributes['aria-checked'], 'mixed');
  parent().checked = true;
  parent().listeners.change();
  assert.equal(parent().indeterminate, false);
  assert.equal(parent().checked, true);
  assert.equal(editor.getDocument().rows[0].children.every((row) => row.checked), true);
  assert.equal(changes.length, 1);
  editor.undo();
  assert.equal(parent().indeterminate, true);
  editor.redo();
  assert.equal(parent().checked, true);
  parent().checked = false;
  parent().listeners.change();
  assert.equal(editor.getDocument().rows[0].children.every((row) => !row.checked), true);
  assert.equal(parent().attributes['aria-checked'], 'false');
});
