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

/** The note layout is an outline preference and travels with the OPML file. */
export function setNoteDisplayMode(document, mode) {
  if (!['inline', 'bottom'].includes(mode) || (document.noteDisplayMode ?? 'inline') === mode) return document;
  return { ...document, noteDisplayMode: mode };
}

/** Change visibility without dropping any note text or changing row identity. */
export function setAllNotesVisible(document, visible) {
  const update = rows => {
    let changed = false;
    const nextRows = rows.map(row => {
      const oldChildren = row.children ?? [];
      const children = update(oldChildren);
      const hasNote = typeof row.note === 'string' && row.note.length > 0;
      const nextVisible = hasNote ? visible : row.noteVisible;
      if (children !== oldChildren || nextVisible !== row.noteVisible) {
        changed = true;
        return { ...row, ...(hasNote ? { noteVisible: visible } : {}), children };
      }
      return row;
    });
    return changed ? nextRows : rows;
  };
  const rows = update(document.rows ?? []);
  return rows === document.rows ? document : { ...document, rows };
}

export function renderNote(row, item, context) {
  const dom = item.ownerDocument;
  const visible = noteIsVisible(row);
  const button = dom.createElement('button');
  button.type = 'button';
  button.className = 'outliner-note-toggle';
  button.textContent = visible ? 'Hide note' : (row.note ? 'Show note' : 'Add note');
  button.setAttribute('aria-expanded', String(visible));
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
