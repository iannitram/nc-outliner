import test from 'node:test';
import assert from 'node:assert/strict';
import { setCheckboxVisibility, setRowChecked } from '../../js/checkboxes.js';
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
  assert.equal(checks()[0].checked, true);
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
