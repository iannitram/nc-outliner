import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditor } from '../../js/editor.js';
import { createCollapseExtension } from '../../js/collapse.js';

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, classList: { add() {} } });
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
  setSelectionRange(start, end) { Object.assign(this, { selectionStart: start, selectionEnd: end }); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}

function fixture() {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const element = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(element, { title: 'Plan', rows: [{ id: 'a', text: 'Parent', children: [{ id: 'b', text: 'Child', children: [] }] }] }, (doc) => changes.push(doc), createCollapseExtension());
  const root = element.children[0];
  const inputs = () => root.querySelectorAll();
  function key(key, input) {
    const event = { key, target: input, preventDefault() { this.prevented = true; } };
    root.listeners.keydown(event);
    return event;
  }
  const button = () => root.children[0].children[0].children[0];
  return { editor, dom, root, changes, inputs, key, button };
}

test('actual editor disclosure click hides children, notifies persistence, and reopens unchanged descendants', () => {
  const f = fixture();
  assert.equal(f.inputs().length, 2);
  assert.equal(f.button().attributes['aria-expanded'], 'true');
  f.button().listeners.click();
  assert.equal(f.inputs().length, 1);
  assert.equal(f.changes.at(-1).rows[0].collapsed, true);
  assert.equal(f.changes.at(-1).rows[0].children[0].id, 'b');
  assert.equal(f.button().attributes['aria-expanded'], 'false');
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
  f.button().listeners.click();
  assert.equal(f.inputs().length, 2);
  assert.equal(f.changes.at(-1).rows[0].children[0].text, 'Child');
});

test('actual editor arrow disclosure preserves interior caret and moves focus across visible hierarchy', () => {
  const f = fixture();
  const parent = f.inputs()[0];
  parent.focus(); parent.setSelectionRange(2, 2);
  assert.equal(f.key('ArrowLeft', parent).prevented, undefined);
  assert.equal(f.inputs().length, 2);
  parent.setSelectionRange(6, 6);
  f.key('ArrowRight', parent);
  assert.equal(f.dom.activeElement.dataset.rowId, 'b');
  f.key('ArrowLeft', f.dom.activeElement);
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
  f.dom.activeElement.setSelectionRange(0, 0);
  f.key('ArrowLeft', f.dom.activeElement);
  assert.equal(f.inputs().length, 1);
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
  f.dom.activeElement.setSelectionRange(6, 6);
  f.key('ArrowRight', f.dom.activeElement);
  assert.equal(f.inputs().length, 2);
  assert.equal(f.dom.activeElement.dataset.rowId, 'a');
});
