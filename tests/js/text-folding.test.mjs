import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditor } from '../../js/editor.js';

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, {
      tag, ownerDocument, children: [], dataset: {}, listeners: {}, value: '',
      selectionStart: 0, selectionEnd: 0, selectionDirection: 'none',
      style: {},
      classes: new Set(), classList: {
        add: (...names) => names.forEach((name) => this.classes.add(name)),
        remove: (...names) => names.forEach((name) => this.classes.delete(name)),
        contains: (name) => this.classes.has(name),
      },
    });
  }
  set className(value) { this.classes = new Set(value.split(/\s+/).filter(Boolean)); }
  get className() { return [...this.classes].join(' '); }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  get firstChild() { return this.children[0]; }
  replaceChildren() { this.children = []; }
  setAttribute() {}
  contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  matches(selector) { return selector === 'textarea[data-row-id]' && this.tag === 'textarea' && !!this.dataset.rowId; }
  querySelectorAll(selector = 'textarea[data-row-id]') {
    return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]);
  }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction = 'none') {
    Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction });
  }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}

function fixture() {
  const dom = { createElement(tag) { return new Element(tag, this); }, activeElement: null };
  const element = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(element, { rows: [
    { id: 'a', text: 'First line\nSecond line\nThird line', children: [] },
    { id: 'b', text: 'Another row', children: [] },
  ] }, (doc) => changes.push(doc));
  const root = element.children[0];
  const inputs = () => root.querySelectorAll();
  const focus = (input) => {
    const previous = dom.activeElement;
    if (previous && previous !== input) root.listeners.focusout({ target: previous });
    input.focus();
    root.listeners.focusin({ target: input });
  };
  const blur = (input) => root.listeners.focusout({ target: input });
  return { editor, root, inputs, changes, dom, focus, blur };
}

test('rows fold on blur and expand for editing without losing multiline text, caret, or history', () => {
  const f = fixture();
  let [input] = f.inputs();
  assert.equal(input.rows, 1);
  assert.equal(input.value, 'First line\nSecond line\nThird line');
  assert.equal(input.classList.contains('outliner-row-text-folded'), true);

  f.focus(input);
  assert.equal(input.rows, 3);
  input.setSelectionRange(18, 18);
  f.root.listeners.beforeinput({ target: input, inputType: 'insertText' });
  input.value = 'First line\nSecond line!\nThird line';
  input.setSelectionRange(19, 19);
  f.root.listeners.input({ target: input });
  assert.equal(f.editor.getDocument().rows[0].text, input.value);
  assert.equal(f.editor.getSelection().offset, 19);
  assert.equal(f.changes.length, 1);

  input.scrollTop = 72;
  input.scrollLeft = 34;
  input.style.height = '240px';
  f.blur(input);
  assert.equal(input.rows, 1);
  assert.equal(input.scrollTop, 0);
  assert.equal(input.scrollLeft, 0);
  assert.equal(input.style.height, '');
  assert.equal(input.value, 'First line\nSecond line!\nThird line');
  assert.equal(input.classList.contains('outliner-row-text-folded'), true);
  f.focus(input);
  assert.equal(input.rows, 3);
  assert.equal(input.selectionStart, 19);

  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[0].text, 'First line\nSecond line\nThird line');
  assert.equal(f.inputs()[0].rows, 3);
  assert.equal(f.editor.getSelection().offset, 18);
  assert.equal(f.changes.length, 2);
});

test('moving focus between rows folds the previous row and leaves keyboard row editing available', () => {
  const f = fixture();
  const [first, second] = f.inputs();
  f.focus(first);
  assert.equal(first.rows, 3);
  f.focus(second);
  assert.equal(first.rows, 1);
  assert.equal(second.rows, 1);
  second.value = 'Another row updated';
  second.setSelectionRange(second.value.length, second.value.length);
  f.root.listeners.input({ target: second });
  const enter = { key: 'Enter', target: second, preventDefault() { this.prevented = true; } };
  f.root.listeners.keydown(enter);
  assert.equal(enter.prevented, true);
  assert.equal(f.editor.getDocument().rows.length, 3);
  assert.deepEqual(f.inputs().map((input) => input.value), ['First line\nSecond line\nThird line', 'Another row updated', '']);
});
