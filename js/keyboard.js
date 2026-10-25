import { createRow, findRow, insertAfter } from './model.js';
import { setCheckboxVisibility, setRowChecked } from './checkboxes.js';

/** Append a child row and expand its selected parent. */
export function insertInside(document, id) {
  if (!findRow(document.rows, id)) return { document, focus: null };
  const next = structuredClone(document);
  const parent = findRow(next.rows, id).row;
  const row = createRow();
  parent.children ??= [];
  parent.children.push(row);
  parent.collapsed = false;
  return { document: next, focus: { id: row.id, offset: 0 } };
}

/** Toggle the selected row and reveal checklist state if it was hidden. */
export function toggleSelectedCheckbox(document, id) {
  const found = findRow(document.rows, id);
  if (!found) return document;
  const next = setRowChecked(document, id, !Boolean(found.row.checked));
  return document.showCheckboxes ? next : setCheckboxVisibility(next, true);
}

/** Keyboard commands for outline structure and row status. */
export function handleKeyboardCommand(event, context) {
  if (event.isComposing || event.keyCode === 229) return false;
  const input = event.target;
  const id = input?.dataset?.rowId;
  if (!id || input.dataset?.noteId) return false;

  if ((event.ctrlKey || event.metaKey) && !event.altKey && event.key === 'Enter') {
    const result = event.shiftKey
      ? insertInside(context.getDocument(), id)
      : insertAfter(context.getDocument(), id);
    if (!result.focus) return false;
    const selection = context.getSelection();
    context.change(() => result.document, {
      type: event.shiftKey ? 'insert-inside' : 'insert-outside',
      selection,
      focus: result.focus,
    });
    return true;
  }

  if ((event.ctrlKey || event.metaKey) && event.shiftKey && !event.altKey && event.key.toLowerCase() === 'x') {
    const document = context.getDocument();
    const next = toggleSelectedCheckbox(document, id);
    context.change(() => next, {
      type: 'checkbox',
      selection: context.getSelection(),
      focus: { id, offset: input.selectionStart ?? 0, end: input.selectionEnd ?? input.selectionStart ?? 0, direction: input.selectionDirection ?? 'none' },
    });
    return true;
  }

  return false;
}
