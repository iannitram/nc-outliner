import { createRow, updateText, insertAfter, deleteEmpty } from './model.js';
import { handleIndentKey } from './indent.js';
import { createCollapseExtension } from './collapse.js';

/** Browser editor. Hooks allow later commands to share one mutation boundary. */
export function mountEditor(element, initialDocument, onChange = () => {}, options = {}) {
  options = { ...createCollapseExtension(), ...options };
  let document = initialDocument;
  let destroyed = false;
  const dom = element.ownerDocument;
  const root = dom.createElement('div');
  root.className = 'outliner-editor';
  root.setAttribute('aria-label', 'Outline rows');
  element.appendChild(root);

  function getSelection() {
    const target = dom.activeElement;
    if (!root.contains(target) || !target.dataset.rowId) return null;
    return { id: target.dataset.rowId, offset: target.selectionStart, end: target.selectionEnd, direction: target.selectionDirection };
  }

  function focusRow(id, offset = 0, end = offset, direction = 'none') {
    const target = [...root.querySelectorAll('textarea[data-row-id]')].find((input) => input.dataset.rowId === id);
    if (!target) return;
    target.focus();
    target.setSelectionRange(Math.min(offset, target.value.length), Math.min(end, target.value.length), direction);
  }

  function change(mutator, meta = {}) {
    if (destroyed) return false;
    const previous = document;
    options.beforeChange?.(previous, meta);
    const next = mutator(previous) ?? previous;
    if (next === previous) return false;
    document = next;
    if (!meta.skipRender) render();
    if (meta.focus) focusRow(meta.focus.id, meta.focus.offset, meta.focus.end, meta.focus.direction);
    options.afterChange?.(document, meta);
    if (meta.notify !== false) onChange(document);
    return true;
  }

  function replaceDocument(next, { selection, notify = true, replay = false } = {}) {
    return change(() => next, { type: 'replace', replay, focus: selection, notify });
  }

  const context = { getDocument: () => document, getSelection, change, replaceDocument, focusRow, render };

  function render() {
    if (destroyed) return;
    root.replaceChildren();
    function renderRows(rows, container) {
      const list = dom.createElement('ul');
      list.className = 'outliner-rows';
      for (const row of rows) {
        const item = dom.createElement('li');
        item.className = 'outliner-row';
        item.dataset.rowId = row.id;
        const input = dom.createElement('textarea');
        input.className = 'outliner-row-text';
        input.dataset.rowId = row.id;
        input.value = row.text ?? '';
        input.rows = Math.max(1, input.value.split('\n').length);
        input.spellcheck = true;
        input.setAttribute('aria-label', 'Row text');
        item.appendChild(input);
        options.renderRow?.(row, item, context);
        if (row.children?.length && options.shouldRenderChildren?.(row) !== false) renderRows(row.children, item);
        list.appendChild(item);
      }
      container.appendChild(list);
    }
    renderRows(document.rows, root);
  }

  function onInput(event) {
    const input = event.target;
    if (!input.matches?.('textarea[data-row-id]')) return;
    change((old) => updateText(old, input.dataset.rowId, input.value), {
      type: 'input', selection: getSelection(), skipRender: true,
    });
    input.rows = Math.max(1, input.value.split('\n').length);
  }

  function onKeyDown(event) {
    const input = event.target;
    if (!input.matches?.('textarea[data-row-id]') || event.isComposing || event.keyCode === 229) return;
    if (options.onKeyDown?.(event, context)) { event.preventDefault(); return; }
    if (handleIndentKey(event, context)) { event.preventDefault(); return; }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    let result;
    if (event.key === 'Enter' && !event.shiftKey) result = insertAfter(document, input.dataset.rowId);
    else if (event.key === 'Backspace' && input.value === '') result = deleteEmpty(document, input.dataset.rowId);
    else if (event.key === 'ArrowUp' || event.key === 'ArrowDown') {
      const atBoundary = event.key === 'ArrowUp' ? input.selectionStart === 0 : input.selectionEnd === input.value.length;
      if (!atBoundary || event.shiftKey) return;
      const inputs = [...root.querySelectorAll('textarea[data-row-id]')];
      const next = inputs[inputs.indexOf(input) + (event.key === 'ArrowUp' ? -1 : 1)];
      if (next) { event.preventDefault(); focusRow(next.dataset.rowId, Math.min(input.selectionStart, next.value.length)); }
      return;
    } else return;
    event.preventDefault();
    change(() => result.document, { type: event.key === 'Enter' ? 'insert' : 'delete', selection: getSelection(), focus: result.focus });
    if (result.focus) focusRow(result.focus.id, result.focus.offset);
  }

  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeyDown);
  if (!document.rows.length) {
    document = { ...document, rows: [createRow()] };
    onChange(document);
  }
  render();
  return { ...context, destroy() {
    destroyed = true;
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
  } };
}
