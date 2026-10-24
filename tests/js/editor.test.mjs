import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditor } from '../../js/editor.js';

// Minimal DOM surface lets tests drive the actual delegated event handlers.
class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, selectionDirection: 'none' });
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  get classList() { return { add() {} }; }
  get firstChild() { return this.children[0]; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  replaceChildren() { for (const child of this.children) child.parent = null; this.children = []; }
  setAttribute() {}
  contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  matches() { return this.tag === 'textarea' && !!this.dataset.rowId; }
  querySelectorAll() { return this.children.flatMap((child) => [...(child.matches() ? [child] : []), ...child.querySelectorAll()]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction) { Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction }); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}
function fixture(document = { rows: [{ id: 'a', text: 'Alpha', children: [] }] }, options = {}) {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const element = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(element, document, (next) => changes.push(next), options);
  const root = element.children[0];
  const inputs = () => root.querySelectorAll('textarea[data-row-id]');
  const event = (key, target, extra = {}) => {
    const e = { key, target, preventDefault() { this.prevented = true; }, ...extra };
    root.listeners.keydown(e); return e;
  };
  return { element, editor, root, changes, inputs, event, dom };
}

test('typing updates document without replacing focused DOM or losing caret', () => {
  const f = fixture(); const input = f.inputs()[0];
  input.focus(); input.value = 'Alpha!'; input.setSelectionRange(6, 6);
  f.root.listeners.input({ target: input });
  assert.equal(f.editor.getDocument().rows[0].text, 'Alpha!');
  assert.equal(f.inputs()[0], input);
  assert.equal(f.dom.activeElement.selectionStart, 6);
  assert.equal(f.changes.length, 1);
});

test('Enter creates a sibling, focuses it; Backspace returns to previous row', () => {
  const f = fixture();
  assert.equal(f.event('Enter', f.inputs()[0]).prevented, true);
  assert.equal(f.inputs().length, 2);
  const blank = f.inputs()[1]; assert.equal(f.dom.activeElement, blank);
  assert.equal(f.event('Backspace', blank).prevented, true);
  assert.equal(f.inputs().length, 1);
  assert.equal(f.dom.activeElement, f.inputs()[0]);
  assert.equal(f.dom.activeElement.selectionStart, 5);
});

test('IME Enter and modified Enter do not create unwanted rows', () => {
  const f = fixture(); const input = f.inputs()[0];
  f.event('Enter', input, { isComposing: true });
  f.event('Enter', input, { keyCode: 229 });
  f.event('Enter', input, { shiftKey: true });
  f.event('Enter', input, { ctrlKey: true });
  assert.equal(f.editor.getDocument().rows.length, 1);
  assert.equal(f.changes.length, 0);
});

test('mutation hooks see old and new documents; custom key handler can act through boundary', () => {
  const seen = [];
  const f = fixture(undefined, {
    beforeChange(doc) { seen.push(doc.rows[0].text); },
    afterChange(doc) { seen.push(doc.rows[0].text); },
    onKeyDown(event, context) {
      if (event.key !== 'Tab') return false;
      context.change((doc) => ({ ...doc, rows: [{ ...doc.rows[0], text: 'Changed' }] }));
      return true;
    },
  });
  assert.equal(f.event('Tab', f.inputs()[0]).prevented, true);
  assert.deepEqual(seen, ['Alpha', 'Changed']);
  assert.equal(f.changes.length, 1);
});

test('arrow navigation only crosses rows at text boundaries', () => {
  const f = fixture({ rows: [{ id: 'a', text: 'Alpha', children: [] }, { id: 'b', text: 'Beta', children: [] }] });
  const [a, b] = f.inputs(); a.focus(); a.setSelectionRange(2, 2);
  f.event('ArrowDown', a); assert.equal(f.dom.activeElement, a);
  a.setSelectionRange(5, 5);
  f.event('ArrowDown', a); assert.equal(f.dom.activeElement, b);
  assert.equal(b.selectionStart, 4);
});

test('empty outlines receive a persistent editable row; destroy removes listeners and DOM', () => {
  const f = fixture({ title: 'Empty', rows: [] });
  assert.equal(f.inputs().length, 1);
  assert.ok(f.editor.getDocument().rows[0].id);
  assert.equal(f.changes.length, 1);
  f.editor.destroy();
  assert.equal(f.element.children.length, 0);
  assert.equal(Object.keys(f.root.listeners).length, 0);
});

test('Tab and Shift+Tab move subtrees through editor and preserve text selection', () => {
  const descendant = { id: 'c', text: 'Child', children: [] };
  const f = fixture({ rows: [
    { id: 'a', text: 'Alpha', children: [], collapsed: true },
    { id: 'b', text: 'Beta', children: [descendant] },
  ] });
  const input = f.inputs()[1]; input.focus(); input.setSelectionRange(1, 3, 'backward');
  assert.equal(f.event('Tab', input).prevented, true);
  assert.equal(f.editor.getDocument().rows[0].children[0].id, 'b');
  assert.equal(f.editor.getDocument().rows[0].collapsed, false);
  assert.equal(f.editor.getDocument().rows[0].children[0].children[0], descendant);
  assert.deepEqual(f.editor.getSelection(), { id: 'b', offset: 1, end: 3, direction: 'backward' });
  assert.equal(f.event('Tab', f.dom.activeElement, { shiftKey: true }).prevented, true);
  assert.deepEqual(f.editor.getDocument().rows.map(r => r.id), ['a', 'b']);
  assert.deepEqual(f.editor.getSelection(), { id: 'b', offset: 1, end: 3, direction: 'backward' });
  assert.equal(f.changes.length, 2);
});

test('indent boundaries retain row focus and do not create a change', () => {
  const f = fixture(); const input = f.inputs()[0]; input.focus(); input.setSelectionRange(2, 2);
  assert.equal(f.event('Tab', input).prevented, true);
  assert.equal(f.event('Tab', input, { shiftKey: true }).prevented, true);
  assert.equal(f.dom.activeElement, input);
  assert.equal(input.selectionStart, 2);
  assert.equal(f.changes.length, 0);
});
