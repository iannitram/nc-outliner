import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditor } from '../../js/editor.js';

const documentFixture = () => ({ title: 'Plan', metadata: { owner: 'A' }, rows: [
  { id: 'a', text: 'Parent', children: [
    { id: 'b', text: 'Focused child', children: [{ id: 'c', text: 'Grandchild', children: [] }] },
    { id: 'd', text: 'Hidden sibling', children: [] },
  ] },
  { id: 'e', text: 'Unrelated section', children: [] },
] });

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
  matches(selector) { return this.tag === 'textarea' && Boolean(this.dataset[selector?.includes('note-id') ? 'noteId' : 'rowId']); }
  querySelectorAll(selector) { return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction = 'none') { Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction }); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}

function mounted() {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const element = new Element('div', dom);
  const notifications = [];
  const editor = mountEditor(element, documentFixture(), (doc) => notifications.push(doc));
  const root = element.children[0];
  const all = () => {
    const walk = node => node.children.flatMap(child => [child, ...walk(child)]);
    return walk(root);
  };
  const rowInput = id => root.querySelectorAll('textarea[data-row-id]').find(input => input.dataset.rowId === id);
  const button = text => all().find(node => node.tag === 'button' && node.textContent === text);
  return { dom, root, editor, notifications, all, rowInput, button };
}

test('Focus row displays the selected section without changing document, history, or autosave notifications', () => {
  const f = mounted();
  const selected = f.rowInput('b');
  assert.equal(f.button('Focus row').disabled, true);
  selected.focus(); selected.setSelectionRange(3, 7, 'backward');
  f.root.listeners.focusin({ target: selected });
  assert.equal(f.button('Focus row').disabled, false);
  f.button('Focus row').listeners.click();
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['b', 'c']);
  assert.equal(f.editor.getDocument().rows[0].children[1].id, 'd');
  assert.equal(f.editor.getDocument().rows[1].id, 'e');
  assert.equal(f.notifications.length, 0);
  assert.deepEqual(f.editor.getHistoryState(), { canUndo: false, canRedo: false });
  assert.equal(f.dom.activeElement.dataset.rowId, 'b');
  assert.deepEqual(f.editor.getSelection(), { id: 'b', offset: 3, end: 7, direction: 'backward' });
});

test('editing in focus mode preserves hidden siblings and undo/redo keeps complete document', () => {
  const f = mounted();
  f.rowInput('b').focus(); f.root.listeners.focusin({ target: f.rowInput('b') });
  f.button('Focus row').listeners.click();
  const input = f.rowInput('b');
  input.value = 'Edited'; input.setSelectionRange(2, 2);
  f.root.listeners.input({ target: input });
  assert.equal(f.notifications.length, 1);
  assert.equal(f.editor.getDocument().rows[0].children[0].text, 'Edited');
  assert.equal(f.editor.getDocument().rows[0].children[1].text, 'Hidden sibling');
  assert.equal(f.editor.getDocument().rows[1].text, 'Unrelated section');
  f.editor.undo();
  assert.equal(f.editor.getDocument().rows[0].children[0].text, 'Focused child');
  assert.equal(f.editor.getDocument().rows[0].children[1].text, 'Hidden sibling');
  f.editor.redo();
  assert.equal(f.editor.getDocument().rows[0].children[0].text, 'Edited');
  assert.equal(f.editor.getDocument().rows[1].text, 'Unrelated section');
});

test('Unfocus restores the entire document, and removing a focused ID safely clears focus', () => {
  const f = mounted();
  f.rowInput('b').focus(); f.root.listeners.focusin({ target: f.rowInput('b') });
  f.button('Focus row').listeners.click();
  f.button('Unfocus').listeners.click();
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['a', 'b', 'c', 'd', 'e']);
  f.rowInput('b').focus(); f.root.listeners.focusin({ target: f.rowInput('b') });
  f.button('Focus row').listeners.click();
  f.editor.change(old => ({ ...old, rows: old.rows.filter(row => row.id !== 'a') }));
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['e']);
  f.button('Unfocus').listeners.click();
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['e']);
});

test('focus honors a collapsed section and replacing a document clears stale focus', () => {
  const f = mounted();
  f.editor.replaceDocument({ title: 'Collapsed', rows: [
    { id: 'a', text: 'Parent', collapsed: true, children: [{ id: 'b', text: 'Child', children: [] }] },
  ] });
  const parent = f.rowInput('a'); parent.focus(); f.root.listeners.focusin({ target: parent });
  f.button('Focus row').listeners.click();
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['a']);
  f.editor.replaceDocument({ title: 'Next outline', rows: [
    { id: 'a', text: 'New parent', collapsed: true, children: [{ id: 'b', text: 'New child', children: [] }] },
  ] });
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['a']);
});

test('Focus clears a search filter that hides the last selected row', () => {
  const f = mounted();
  const selected = f.rowInput('b');
  selected.focus(); selected.setSelectionRange(2, 2);
  f.root.listeners.focusout({ target: selected });
  const search = f.root.children.find(node => node.className === 'outliner-search').children[0];
  search.value = 'no match';
  search.listeners.input();
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]'), []);
  assert.equal(f.button('Focus row').disabled, false);
  f.button('Focus row').listeners.click();
  assert.equal(search.value, '');
  assert.deepEqual(f.root.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['b', 'c']);
  assert.equal(f.notifications.length, 0);
});
