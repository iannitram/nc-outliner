import test from 'node:test';
import assert from 'node:assert/strict';
import { matchingRowIds } from '../../js/search.js';
import { mountEditor } from '../../js/editor.js';

const fixture = () => ({ title: 'Plan', metadata: { owner: 'A' }, rows: [
  { id: 'a', text: 'Parent', collapsed: true, children: [
    { id: 'b', text: 'Child [literal].*', children: [] },
    { id: 'c', text: 'Other child', children: [] },
  ] },
  { id: 'd', text: 'Unrelated', children: [] },
] });

test('case-insensitive matches include ancestor paths through collapsed rows', () => {
  const doc = fixture();
  assert.deepEqual([...matchingRowIds(doc.rows, 'CHILD [literal]')].sort(), ['a', 'b']);
  assert.equal(doc.rows[0].collapsed, true);
});

test('empty query disables filtering and no matches returns empty set', () => {
  assert.equal(matchingRowIds(fixture().rows, '  '), null);
  assert.equal(matchingRowIds(fixture().rows, 'missing').size, 0);
});

test('punctuation is literal and matching parent does not include unrelated descendants', () => {
  assert.deepEqual([...matchingRowIds(fixture().rows, '.*')].sort(), ['a', 'b']);
  assert.deepEqual([...matchingRowIds(fixture().rows, 'Parent')], ['a']);
});

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, selectionDirection: 'none' });
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  get classList() { return { add() {} }; }
  get firstChild() { return this.children[0]; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  replaceChildren() { for (const child of this.children) child.parent = null; this.children = []; }
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
function mounted(document = fixture()) {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const element = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(element, document, (doc) => changes.push(doc));
  const root = element.children[0];
  const searchPanel = root.children.find(el => el.className === 'outliner-search');
  const [input, clear, status] = searchPanel.children;
  const rows = () => root.querySelectorAll().map(el => el.dataset.rowId);
  const query = text => { input.value = text; input.setSelectionRange(text.length, text.length); input.listeners.input(); };
  return { dom, root, input, clear, status, editor, rows, query, changes };
}

test('actual editor search reveals collapsed matches, keeps query focus, and restores collapse on clear', () => {
  const f = mounted();
  assert.deepEqual(f.rows(), ['a', 'd']);
  f.query('Child [literal]');
  assert.deepEqual(f.rows(), ['a', 'b']);
  assert.equal(f.dom.activeElement, f.input);
  assert.equal(f.input.selectionStart, 'Child [literal]'.length);
  assert.equal(f.editor.getDocument().rows[0].collapsed, true);
  assert.equal(f.changes.length, 0);
  assert.deepEqual(f.editor.getHistoryState(), { canUndo: false, canRedo: false });
  f.clear.listeners.click();
  assert.deepEqual(f.rows(), ['a', 'd']);
  assert.equal(f.input.value, '');
  assert.equal(f.editor.getDocument().rows[0].collapsed, true);
});

test('editing filtered row preserves hidden tree and metadata in save notification', () => {
  const f = mounted(); f.query('literal');
  const row = f.root.querySelectorAll().find(el => el.dataset.rowId === 'b');
  row.focus(); row.value = 'New literal';
  f.root.listeners.input({ target: row });
  const document = f.changes.at(-1);
  assert.equal(document.rows[0].children[0].text, 'New literal');
  assert.equal(document.rows[0].children[1].text, 'Other child');
  assert.equal(document.rows[1].text, 'Unrelated');
  assert.deepEqual(document.metadata, { owner: 'A' });
});

test('no results is announced and Escape clears without editing document', () => {
  const f = mounted(); f.query('missing');
  assert.deepEqual(f.rows(), []);
  assert.equal(f.status.hidden, false);
  assert.equal(f.status.attributes.role, 'status');
  assert.equal(f.status.textContent, 'No matching rows');
  let prevented = false;
  f.input.listeners.keydown({ key: 'Escape', preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.deepEqual(f.rows(), ['a', 'd']);
  assert.equal(f.status.hidden, true);
  assert.equal(f.changes.length, 0);
});

test('editing a filtered match updates results without removing data from the stored document', () => {
  const f = mounted(); f.query('literal');
  const row = f.root.querySelectorAll().find(el => el.dataset.rowId === 'b');
  row.focus(); row.value = 'No longer matches'; row.setSelectionRange(3, 3);
  f.root.listeners.input({ target: row });
  assert.deepEqual(f.rows(), []);
  assert.equal(f.editor.getDocument().rows[0].children[0].text, 'No longer matches');
  assert.equal(f.editor.getDocument().rows[0].children.length, 2);
  assert.equal(f.dom.activeElement, f.input);
  assert.equal(f.status.hidden, false);
});

test('typing a visible note while filtering keeps the note caret and hidden outline data', () => {
  const document = fixture();
  Object.assign(document.rows[0].children[0], { note: 'Original note', noteVisible: true });
  const f = mounted(document);
  f.query('literal');
  const note = f.root.querySelectorAll('textarea[data-note-id]')[0];
  note.focus(); note.setSelectionRange(2, 5, 'backward');
  f.root.listeners.beforeinput({ target: note, inputType: 'insertText' });
  note.value = 'Changed note'; note.setSelectionRange(3, 7, 'backward');
  f.root.listeners.input({ target: note });
  const renderedNote = f.root.querySelectorAll('textarea[data-note-id]')[0];
  assert.equal(f.dom.activeElement, renderedNote);
  assert.deepEqual(f.editor.getSelection(), { id: 'b', field: 'note', offset: 3, end: 7, direction: 'backward' });
  assert.equal(renderedNote.value, 'Changed note');
  assert.deepEqual(f.rows(), ['a', 'b']);
  const saved = f.changes.at(-1);
  assert.equal(saved.rows[0].children[0].note, 'Changed note');
  assert.equal(saved.rows[0].children[1].text, 'Other child');
  assert.equal(saved.rows[1].text, 'Unrelated');
  assert.equal(saved.rows[0].collapsed, true);
});
