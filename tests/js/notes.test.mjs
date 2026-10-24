import test from 'node:test';
import assert from 'node:assert/strict';
import { mountEditor } from '../../js/editor.js';
import { updateNote, setNoteVisible, noteIsVisible } from '../../js/notes.js';
import { deleteEmpty } from '../../js/model.js';

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
  matches(selector) { return this.tag === 'textarea' && !!this.dataset[selector?.includes('note-id') ? 'noteId' : 'rowId']; }
  querySelectorAll(selector) { return this.children.flatMap((child) => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
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

const all = (element) => [element, ...element.children.flatMap(all)];
const notes = (f) => f.root.querySelectorAll('textarea[data-note-id]');
const toggle = (f) => all(f.root).find((el) => el.className === 'outliner-note-toggle');

test('note edits and visibility preserve descendants, metadata, identity and original', () => {
  const doc = { title: 'Plan', custom: 9, rows: [{ id: 'a', text: 'Topic', custom: { color: 'red' }, children: [{ id: 'b', text: 'Child', children: [] }] }] };
  const next = updateNote(doc, 'a', 'Line one\nLine two');
  assert.equal(doc.rows[0].note, undefined);
  assert.equal(next.rows[0].note, 'Line one\nLine two');
  assert.equal(next.rows[0].children[0].id, 'b');
  assert.deepEqual(next.rows[0].custom, doc.rows[0].custom);
  assert.equal(next.custom, 9);
  const hidden = setNoteVisible(next, 'a', false);
  assert.equal(noteIsVisible(hidden.rows[0]), false);
  assert.equal(hidden.rows[0].note, next.rows[0].note);
  assert.equal(noteIsVisible(setNoteVisible(hidden, 'a', true).rows[0]), true);
});

test('unchanged notes, missing rows and unchanged visibility are no-op edits', () => {
  const doc = { rows: [{ id: 'a', text: 'Topic', children: [] }] };
  assert.equal(updateNote(doc, 'a', ''), doc);
  assert.equal(updateNote(doc, 'missing', 'Note'), doc);
  assert.equal(setNoteVisible(doc, 'missing', true), doc);
  assert.equal(setNoteVisible(doc, 'a', false), doc);
});

test('Shift+Enter opens the note and preserves multiline note editing without adding rows', () => {
  const f = fixture();
  f.inputs()[0].focus();
  assert.equal(f.event('Enter', f.inputs()[0], { shiftKey: true }).prevented, true);
  assert.equal(f.inputs().length, 1);
  assert.equal(notes(f).length, 1);
  const note = notes(f)[0];
  assert.equal(f.dom.activeElement, note);
  note.value = 'Line one\nLine two'; note.setSelectionRange(17, 17);
  f.root.listeners.input({ target: note });
  assert.equal(f.editor.getDocument().rows[0].note, 'Line one\nLine two');
  assert.equal(f.editor.getDocument().rows[0].text, 'Alpha');
  assert.equal(f.event('Enter', note).prevented, undefined);
  assert.equal(f.inputs().length, 1);
  assert.equal(f.event('Escape', note).prevented, true);
  assert.equal(f.dom.activeElement, f.inputs()[0]);
});

test('note visibility buttons hide and restore note text and notify persistence', () => {
  const f = fixture({ rows: [{ id: 'a', text: 'Alpha', note: 'Keep me', children: [] }] });
  assert.equal(notes(f).length, 1);
  toggle(f).listeners.click();
  assert.equal(notes(f).length, 0);
  assert.equal(f.editor.getDocument().rows[0].note, 'Keep me');
  assert.equal(f.changes.at(-1).rows[0].noteVisible, false);
  toggle(f).listeners.click();
  assert.equal(notes(f)[0].value, 'Keep me');
  assert.equal(f.dom.activeElement, notes(f)[0]);
});

test('note typing uses common history and restores note caret during undo and redo', () => {
  const f = fixture({ rows: [{ id: 'a', text: 'Alpha', note: 'Original', noteVisible: true, children: [] }] });
  const note = notes(f)[0]; note.focus(); note.setSelectionRange(2, 5, 'backward');
  f.root.listeners.beforeinput({ target: note, inputType: 'insertText' });
  note.value = 'Or!nal'; note.setSelectionRange(3, 3);
  f.root.listeners.input({ target: note });
  assert.equal(f.event('z', note, { ctrlKey: true }).prevented, true);
  assert.equal(notes(f)[0].value, 'Original');
  assert.equal(f.dom.activeElement, notes(f)[0]);
  assert.equal(f.dom.activeElement.selectionStart, 2);
  assert.equal(f.dom.activeElement.selectionEnd, 5);
  assert.equal(f.dom.activeElement.selectionDirection, 'backward');
  f.event('z', notes(f)[0], { ctrlKey: true, shiftKey: true });
  assert.equal(notes(f)[0].value, 'Or!nal');
  assert.equal(f.dom.activeElement.selectionStart, 3);
});

test('Backspace on an empty topic never silently deletes a nonempty note', () => {
  const document = { rows: [{ id: 'a', text: '', note: 'Important', children: [] }, { id: 'b', text: 'Other', children: [] }] };
  assert.equal(deleteEmpty(document, 'a').document, document);
});
