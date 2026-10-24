import { createRow, findRow, flattenVisibleRows } from './model.js';

/** Delete one complete subtree, keeping one editable row in an empty document. */
export function deleteRow(document, id) {
  const visible = flattenVisibleRows(document.rows);
  const index = visible.findIndex((row) => row.id === id);
  if (index < 0) return { document, focus: null };
  const removed = flattenVisibleRows([visible[index]]);
  const destination = visible[index - 1] ?? visible[index + removed.length];
  const next = structuredClone(document);
  const found = findRow(next.rows, id);
  found.siblings.splice(found.index, 1);
  if (!next.rows.length) next.rows.push(createRow());
  const focus = destination
    ? { id: destination.id, offset: index > 0 ? destination.text.length : 0 }
    : { id: next.rows[0].id, offset: 0 };
  return { document: next, focus };
}

/** Move among siblings without changing the row's level or descendants. */
export function moveRow(document, id, direction) {
  const found = findRow(document.rows, id);
  if (!found || ![-1, 1].includes(direction)) return document;
  const target = found.index + direction;
  if (target < 0 || target >= found.siblings.length) return document;
  const next = structuredClone(document);
  const row = findRow(next.rows, id);
  [row.siblings[row.index], row.siblings[target]] = [row.siblings[target], row.siblings[row.index]];
  return next;
}

function applyDelete(id, context) {
  const result = deleteRow(context.getDocument(), id);
  context.change(() => result.document, {
    type: 'delete-row', selection: context.getSelection(), focus: result.focus,
  });
}

/** Alt shortcuts leave normal text deletion and cursor movement untouched. */
export function handleRowActionKey(event, context) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing || event.keyCode === 229) return false;
  const input = event.target;
  const id = input?.dataset?.rowId;
  if (!id || !['Delete', 'ArrowUp', 'ArrowDown'].includes(event.key)) return false;
  if (event.key === 'Delete') applyDelete(id, context);
  else {
    const next = moveRow(context.getDocument(), id, event.key === 'ArrowUp' ? -1 : 1);
    const selection = context.getSelection() ?? { id, offset: input.selectionStart ?? 0, end: input.selectionEnd ?? 0 };
    context.change(() => next, { type: 'move-row', selection, focus: selection });
  }
  return true;
}

export function renderRowActions(row, item, context) {
  const button = item.ownerDocument.createElement('button');
  button.type = 'button';
  button.className = 'outliner-delete-row';
  button.textContent = 'Delete row';
  button.setAttribute('aria-label', row.children?.length ? 'Delete row and its children' : 'Delete row');
  button.setAttribute('aria-keyshortcuts', 'Alt+Delete');
  button.title = 'Delete this row and its children (Alt+Delete). Undo restores them.';
  button.addEventListener('mousedown', (event) => event.preventDefault());
  button.addEventListener('click', () => applyDelete(row.id, context));
  item.appendChild(button);
}
