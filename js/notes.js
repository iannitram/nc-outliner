import { findRow } from './model.js';

/** Notes travel with rows, including extension data and descendants. */
export function updateNote(document, id, note) {
  const found = findRow(document.rows, id);
  if (!found || (found.row.note ?? '') === note) return document;
  const next = structuredClone(document);
  findRow(next.rows, id).row.note = note;
  return next;
}

export function noteIsVisible(row) {
  return row.noteVisible ?? Boolean(row.note);
}

export function setNoteVisible(document, id, visible) {
  const found = findRow(document.rows, id);
  if (!found || noteIsVisible(found.row) === visible) return document;
  const next = structuredClone(document);
  findRow(next.rows, id).row.noteVisible = visible;
  return next;
}

export function renderNote(row, item, context, { reveal = false } = {}) {
  const dom = item.ownerDocument;
  const visible = reveal || noteIsVisible(row);
  const button = dom.createElement('button');
  button.type = 'button';
  button.className = 'outliner-note-toggle';
  button.textContent = visible ? 'Hide note' : (row.note ? 'Show note' : 'Add note');
  button.setAttribute('aria-expanded', String(visible));
  if (reveal && !noteIsVisible(row)) { button.disabled = true; button.title = 'This note is revealed by the current search.'; }
  button.addEventListener('click', () => context.change(
    (document) => setNoteVisible(document, row.id, !visible),
    { type: 'note-visibility', focus: { id: row.id, offset: 0, field: visible ? 'text' : 'note' } },
  ));
  item.appendChild(button);
  if (!visible) return;
  const note = dom.createElement('textarea');
  note.className = 'outliner-note';
  note.dataset.noteId = row.id;
  note.value = row.note ?? '';
  note.rows = Math.max(2, note.value.split('\n').length);
  note.spellcheck = true;
  note.setAttribute('aria-label', 'Row note');
  item.appendChild(note);
}
