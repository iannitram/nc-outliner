import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditor } from '../../js/editor.js';

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, selectionDirection: 'none', classList: { add() {} } });
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  get firstChild() { return this.children[0]; }
  replaceChildren() { this.children = []; }
  setAttribute(name, value) { this.attributes[name] = value; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  matches(selector) { return this.tag === 'textarea' && Boolean(this.dataset[selector?.includes('note-id') ? 'noteId' : 'rowId']); }
  querySelectorAll(selector) { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction = 'none') { Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction }); }
}

function fixture(document = { rows: [
  { id: 'a', text: 'Alpha', collapsed: true, children: [{ id: 'b', text: 'Child', children: [] }] },
  { id: 'c', text: 'Gamma', children: [] },
] }) {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const host = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(host, document, next => changes.push(next));
  const root = host.children[0];
  const all = () => [root, ...root.children.flatMap(function walk(node) { return [node, ...node.children.flatMap(walk)]; })];
  const input = id => root.querySelectorAll('textarea[data-row-id]').find(node => node.dataset.rowId === id);
  const button = name => all().find(node => node.tag === 'button' && node.textContent === name);
  const key = (target, keyName, extra = {}) => {
    const event = { target, key: keyName, preventDefault() { this.prevented = true; }, ...extra };
    root.listeners.keydown(event);
    return event;
  };
  return { dom, root, editor, changes, all, input, button, key };
}

test('Ctrl/Meta+Enter adds outside and Ctrl/Meta+Shift+Enter adds inside with undo and caret', () => {
  const f = fixture();
  const parent = f.input('a');
  parent.focus(); parent.setSelectionRange(2, 4, 'backward');
  const inside = f.key(parent, 'Enter', { ctrlKey: true, shiftKey: true });
  assert.equal(inside.prevented, true);
  const childId = f.editor.getDocument().rows[0].children[1].id;
  assert.equal(f.editor.getDocument().rows[0].collapsed, false);
  assert.equal(f.dom.activeElement.dataset.rowId, childId);
  assert.equal(f.editor.getHistoryState().canUndo, true);
  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[0].children.length, 1);
  f.editor.redo();
  assert.equal(f.editor.getDocument().rows[0].children[1].id, childId);

  const child = f.input(childId);
  child.focus(); child.setSelectionRange(1, 1);
  assert.equal(f.key(child, 'Enter', { metaKey: true }).prevented, true);
  assert.equal(f.editor.getDocument().rows[0].children[2].text, '');
  assert.equal(f.dom.activeElement.dataset.rowId, f.editor.getDocument().rows[0].children[2].id);
});

test('Ctrl/Meta+Shift+X toggles status through history and shows hidden checkboxes', () => {
  const f = fixture();
  const selected = f.input('a');
  selected.focus(); selected.setSelectionRange(3, 3);
  const result = f.key(selected, 'X', { ctrlKey: true, shiftKey: true });
  assert.equal(result.prevented, true);
  assert.equal(f.editor.getDocument().showCheckboxes, true);
  assert.equal(f.editor.getDocument().rows[0].checked, true);
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
  f.editor.undo();
  assert.equal(f.editor.getDocument().showCheckboxes, undefined);
  assert.equal(f.editor.getDocument().rows[0].checked, undefined);
});

test('Alt+Shift+F focuses and restores the selected section without editing or autosave', () => {
  const f = fixture({ rows: [
    { id: 'a', text: 'Alpha', children: [{ id: 'b', text: 'Child', children: [] }] },
    { id: 'c', text: 'Gamma', children: [] },
  ] });
  const selected = f.input('a');
  selected.focus(); selected.setSelectionRange(2, 4, 'backward');
  const focus = f.key(selected, 'F', { altKey: true, shiftKey: true });
  assert.equal(focus.prevented, true);
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(row => row.dataset.rowId), ['a', 'b']);
  assert.equal(f.changes.length, 0);
  const active = f.input('a');
  assert.equal(f.key(active, 'f', { altKey: true, shiftKey: true }).prevented, true);
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(row => row.dataset.rowId), ['a', 'b', 'c']);
  assert.equal(f.changes.length, 0);
});

test('keyboard help and aria shortcuts expose the complete set; IME commands are ignored', () => {
  const f = fixture();
  const help = f.all().find(node => node.tag === 'details');
  assert.match(help.children[0].textContent, /Keyboard shortcuts/);
  assert.match(help.children[1].children.map(item => item.textContent).join(' '), /Add a child.*Tab.*Shift\+Tab.*checkbox.*note.*Focus/s);
  assert.match(f.input('a').attributes['aria-keyshortcuts'], /Control\+Shift\+Enter/);
  const input = f.input('a');
  f.key(input, 'Enter', { ctrlKey: true, shiftKey: true, isComposing: true });
  f.key(input, 'X', { ctrlKey: true, shiftKey: true, keyCode: 229 });
  assert.equal(f.editor.getDocument().rows[0].children.length, 1);
  assert.equal(f.editor.getDocument().rows[0].checked, undefined);
  assert.equal(f.changes.length, 0);
});
