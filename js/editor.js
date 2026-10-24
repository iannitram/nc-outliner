import { createCheckboxToggle, updateCheckboxToggle, renderCheckbox } from './checkboxes.js';
import { createHistory, historyCommand } from './history.js';
import { createRowSelection, actOnRows } from './selection.js';
import { createRow, updateText, insertAfter, deleteEmpty, flattenRows } from './model.js';
import { handleIndentKey } from './indent.js';
import { createCollapseExtension } from './collapse.js';
import { updateNote, setNoteVisible, renderNote } from './notes.js';
import { handleRowActionKey, renderRowActions } from './row-actions.js';
import { handleExpansionKey, mountExpansionControls } from './expansion.js';
import { matchingRowIds } from './search.js';
import { mountTimestampControls } from './timestamp.js';

/** Browser editor. Hooks allow later commands to share one mutation boundary. */
export function mountEditor(element, initialDocument, onChange = () => {}, options = {}) {
  options = { ...createCollapseExtension(), ...options };
  let document = initialDocument;
  let destroyed = false;
  const history = createHistory({ document, selection: null });
  let pendingSelection = null;
  let lastRowSelection = null;
  const rowSelection = createRowSelection();
  let renderedRows = [];
  const dom = element.ownerDocument;
  const root = dom.createElement('div');
  root.className = 'outliner-editor';
  root.setAttribute('aria-label', 'Outline rows');
  element.appendChild(root);
  const toolbar = dom.createElement('div');
  toolbar.setAttribute('role', 'toolbar');
  toolbar.setAttribute('aria-label', 'Outline actions');
  const undoButton = dom.createElement('button');
  const redoButton = dom.createElement('button');
  undoButton.type = redoButton.type = 'button';
  undoButton.textContent = 'Undo';
  redoButton.textContent = 'Redo';
  undoButton.addEventListener('click', () => replay('undo'));
  redoButton.addEventListener('click', () => replay('redo'));
  // Keep the editing selection when clicking a history control.
  undoButton.addEventListener('mousedown', (event) => event.preventDefault());
  redoButton.addEventListener('mousedown', (event) => event.preventDefault());
  toolbar.appendChild(undoButton);
  toolbar.appendChild(redoButton);
  const searchPanel = dom.createElement('div');
  searchPanel.className = 'outliner-search';
  const searchInput = dom.createElement('input');
  searchInput.type = 'search';
  searchInput.setAttribute('aria-label', 'Search rows');
  searchInput.placeholder = 'Search rows';
  const clearSearch = dom.createElement('button');
  clearSearch.type = 'button';
  clearSearch.textContent = 'Clear search';
  const searchStatus = dom.createElement('p');
  searchStatus.setAttribute('role', 'status');
  searchStatus.textContent = 'No matching rows';
  searchPanel.appendChild(searchInput);
  searchPanel.appendChild(clearSearch);
  searchPanel.appendChild(searchStatus);
  let searchQuery = '';
  function setSearchQuery(query) {
    if (destroyed) return;
    searchQuery = query;
    searchInput.value = query;
    const start = searchInput.selectionStart;
    const end = searchInput.selectionEnd;
    render();
    searchInput.focus();
    if (start !== null && end !== null) searchInput.setSelectionRange(start, end);
  }
  searchInput.addEventListener('input', () => setSearchQuery(searchInput.value));
  searchInput.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') { event.preventDefault(); setSearchQuery(''); }
  });
  clearSearch.addEventListener('click', () => setSearchQuery(''));
  const unsubscribe = history.subscribe(({ canUndo, canRedo }) => {
    undoButton.disabled = !canUndo;
    redoButton.disabled = !canRedo;
  });

  function replay(command) {
    if (destroyed) return false;
    const snapshot = history[command]();
    if (!snapshot) return false;
    return replaceDocument(snapshot.document, { selection: snapshot.selection, replay: true });
  }

  function getSelection() {
    const target = dom.activeElement;
    const selected = rowSelection.get();
    const extra = selected.ids.length ? { rowIds: selected.ids, rowAnchor: selected.anchor } : {};
    if (!root.contains(target) || !(target.dataset.rowId || target.dataset.noteId)) return selected.ids.length ? { ...(lastRowSelection?.id === selected.active ? lastRowSelection : { id: selected.active ?? selected.ids[0], offset: 0 }), ...extra } : null;
    return { ...extra, id: target.dataset.rowId ?? target.dataset.noteId, offset: target.selectionStart, end: target.selectionEnd, direction: target.selectionDirection,
      ...(target.dataset.noteId ? { field: 'note' } : {}) };
  }

  function focusRow(id, offset = 0, end = offset, direction = 'none', field = 'text') {
    const attribute = field === 'note' ? 'noteId' : 'rowId';
    const target = [...root.querySelectorAll(field === 'note' ? 'textarea[data-note-id]' : 'textarea[data-row-id]')].find((input) => input.dataset[attribute] === id);
    if (!target) return;
    if (field === 'text' && !rowSelection.get().ids.length) rowSelection.clear(id);
    target.focus();
    target.setSelectionRange(Math.min(offset, target.value.length), Math.min(end, target.value.length), direction);
  }

  function change(mutator, meta = {}) {
    if (destroyed) return false;
    const previous = document;
    const previousSelection = meta.selection ?? getSelection();
    options.beforeChange?.(previous, meta);
    const next = mutator(previous) ?? previous;
    if (next === previous) return false;
    document = next;
    if (!meta.skipRender) render();
    if (meta.focus) focusRow(meta.focus.id, meta.focus.offset, meta.focus.end, meta.focus.direction, meta.focus.field);
    if (meta.type === 'replace' && !meta.replay) history.reset({ document, selection: getSelection() });
    else if (!meta.replay) history.record({ document, selection: getSelection() }, previousSelection);
    options.afterChange?.(document, meta);
    if (meta.notify !== false) onChange(document);
    return true;
  }

  function replaceDocument(next, { selection, notify = true, replay = false } = {}) {
    pendingSelection = null;
    if (!replay) lastRowSelection = null;
    rowSelection.restore(replay ? selection : null);
    return change(() => next, { type: 'replace', replay, focus: selection, notify });
  }

  let checkboxToggle;
  const context = { undo: () => replay('undo'), redo: () => replay('redo'), getHistoryState: history.getState, getDocument: () => document, getSelectedRowIds: () => rowSelection.get().ids, getSelection, change, replaceDocument, focusRow, render };
  mountExpansionControls(toolbar, context, () => getSelection() ?? lastRowSelection);

  mountTimestampControls(toolbar, context, () => getSelection() ?? lastRowSelection, options.timestamp);

  const selectionStatus = dom.createElement('span');
  selectionStatus.setAttribute('role', 'status');
  toolbar.appendChild(selectionStatus);
  const selectionButtons = [];
  for (const [action, label] of [['delete','Delete selected'], ['indent','Indent selected'], ['outdent','Outdent selected'], ['up','Move selected up'], ['down','Move selected down'], ['check','Check selected'], ['uncheck','Uncheck selected']]) {
    const button = dom.createElement('button');
    button.type = 'button'; button.textContent = label;
    button.addEventListener('mousedown', event => event.preventDefault());
    button.addEventListener('click', () => applySelectionAction(action));
    toolbar.appendChild(button); selectionButtons.push(button);
  }
  function visibleIds() { return renderedRows.map(row => row.id); }
  function updateSelectionUI() {
    rowSelection.reconcile(visibleIds());
    const selected = rowSelection.get().ids;
    for (const row of renderedRows) {
      row.item.dataset.selected = String(selected.includes(row.id));
      row.button.setAttribute('aria-pressed', String(selected.includes(row.id)));
    }
    selectionStatus.textContent = `${selected.length} rows selected`;
    for (const button of selectionButtons) button.disabled = !selected.length;
  }
  function applySelectionAction(action) {
    const selected = rowSelection.get();
    if (!selected.ids.length) return;
    const selection = getSelection();
    const next = actOnRows(document, selected.ids, action);
    const focusId = flattenRows(next.rows).some(row => row.id === selected.active) ? selected.active : next.rows[0]?.id;
    change(() => next, { type: `selection-${action}`, selection, focus: selection?.id === focusId ? selection : { id: focusId, offset: 0 } });
  }
  function onRowClick(event) {
    const target = event.target;
    const id = target.dataset?.selectRowId ?? (target.matches?.('textarea[data-row-id]') ? target.dataset.rowId : null);
    if (!id) return;
    if (event.shiftKey || event.ctrlKey || event.metaKey || target.dataset.selectRowId) {
      event.preventDefault();
      if (!rowSelection.get().ids.length && !rowSelection.get().anchor) rowSelection.clear(lastRowSelection?.id ?? id);
      rowSelection.select(id, { shift: event.shiftKey, toggle: event.ctrlKey || event.metaKey }, visibleIds());
      updateSelectionUI();
      focusRow(id);
    } else { rowSelection.clear(id); updateSelectionUI(); }
  }


  function render() {
    if (destroyed) return;
    root.replaceChildren();
    renderedRows = [];
    if (!checkboxToggle) {
      checkboxToggle = createCheckboxToggle(dom, context);
      toolbar.appendChild(checkboxToggle);
    }
    updateCheckboxToggle(checkboxToggle, document);
    root.appendChild(toolbar);
    root.appendChild(searchPanel);
    const included = matchingRowIds(document.rows, searchQuery);
    clearSearch.disabled = included === null;
    searchStatus.hidden = included === null || included.size > 0;
    function renderRows(rows, container) {
      const list = dom.createElement('ul');
      list.className = 'outliner-rows';
      for (const row of rows) {
        if (included && !included.has(row.id)) continue;
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
        input.setAttribute('aria-keyshortcuts', 'Alt+ArrowUp Alt+ArrowDown Alt+Delete Shift+ArrowUp Shift+ArrowDown');
        input.title = 'Move row: Alt+Up/Down. Delete row and children: Alt+Delete. Select rows: Shift/Ctrl/Cmd+click or Shift+Up/Down; Escape clears.';
        item.appendChild(input);
        const selectButton = dom.createElement('button');
        selectButton.type = 'button';
        selectButton.dataset.selectRowId = row.id;
        selectButton.className = 'outliner-select-row';
        selectButton.textContent = 'Select row';
        selectButton.setAttribute('aria-label', `Select row: ${row.text || 'Untitled'}`);
        selectButton.title = 'Select row. Shift+click selects a range; Ctrl/Cmd+click adds or removes rows. Shift+Up/Down extends selection; Escape clears.';
        item.appendChild(selectButton);
        renderedRows.push({ id: row.id, item, button: selectButton });
        options.renderRow?.(row, item, context);
        renderNote(row, item, context);
        renderCheckbox(row, item, context);
        renderRowActions(row, item, context);
        if (row.children?.length && (included || options.shouldRenderChildren?.(row) !== false)) renderRows(row.children, item);
        list.appendChild(item);
      }
      container.appendChild(list);
    }
    renderRows(document.rows, root);
    updateSelectionUI();
  }

  function onInput(event) {
    const input = event.target;
    const isNote = Boolean(input.dataset?.noteId);
    if (!isNote && !input.matches?.('textarea[data-row-id]')) return;
    change((old) => isNote ? updateNote(old, input.dataset.noteId, input.value) : updateText(old, input.dataset.rowId, input.value), {
      type: 'input', selection: pendingSelection ?? getSelection(), skipRender: true,
    });
    pendingSelection = null;
    input.rows = Math.max(1, input.value.split('\n').length);
    if (searchQuery.trim()) {
      const selection = getSelection();
      const included = matchingRowIds(document.rows, searchQuery);
      render();
      if (selection && included.has(selection.id)) focusRow(selection.id, selection.offset, selection.end, selection.direction, selection.field);
      else searchInput.focus();
    }
  }

  function onKeyDown(event) {
    const input = event.target;
    const isNote = Boolean(input.dataset?.noteId);
    if ((!isNote && !input.matches?.('textarea[data-row-id]')) || event.isComposing || event.keyCode === 229) return;
    const command = historyCommand(event);
    if (command) { event.preventDefault(); replay(command); return; }
    if (!isNote && event.key === 'Escape') { rowSelection.clear(input.dataset.rowId); updateSelectionUI(); return; }
    if (!isNote && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey && ['ArrowUp', 'ArrowDown'].includes(event.key)) {
      event.preventDefault();
      const visible = visibleIds();
      const state = rowSelection.get();
      const current = state.ids.length ? state.active : input.dataset.rowId;
      if (!state.ids.length) rowSelection.clear(current);
      const index = visible.indexOf(current);
      const destination = visible[Math.max(0, Math.min(visible.length - 1, index + (event.key === 'ArrowUp' ? -1 : 1)))];
      rowSelection.select(destination, { shift: true }, visible);
      updateSelectionUI(); focusRow(destination);
      return;
    }
    if (!isNote && rowSelection.get().ids.length > 1 && !event.ctrlKey && !event.metaKey) {
      let action;
      if (event.key === 'Tab' && !event.altKey) action = event.shiftKey ? 'outdent' : 'indent';
      else if (event.altKey && !event.shiftKey) action = { Delete: 'delete', ArrowUp: 'up', ArrowDown: 'down' }[event.key];
      if (action) { event.preventDefault(); applySelectionAction(action); return; }
    }
    if (isNote) {
      if (event.key === 'Escape' || (event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey)) {
        event.preventDefault(); focusRow(input.dataset.noteId);
      }
      return;
    }
    if (event.key === 'Enter' && event.shiftKey && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      const focus = { id: input.dataset.rowId, offset: 0, field: 'note' };
      if (!change((old) => setNoteVisible(old, input.dataset.rowId, true), { type: 'note-visibility', focus })) focusRow(input.dataset.rowId, 0, 0, 'none', 'note');
      return;
    }
    if (handleExpansionKey(event, context)) { event.preventDefault(); return; }
    if (options.onKeyDown?.(event, context)) { event.preventDefault(); return; }
    if (handleIndentKey(event, context)) { event.preventDefault(); return; }
    if (handleRowActionKey(event, context)) { event.preventDefault(); return; }
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

  function onBeforeInput(event) {
    if (event.target.matches?.('textarea[data-row-id]') || event.target.dataset?.noteId) pendingSelection = getSelection();
    if (event.inputType === 'historyUndo' || event.inputType === 'historyRedo') {
      event.preventDefault();
      replay(event.inputType === 'historyUndo' ? 'undo' : 'redo');
    }
  }
  function onFocusOut(event) {
    const target = event.target;
    const id = target.dataset?.rowId ?? target.dataset?.noteId;
    if (id && (target.matches?.('textarea[data-row-id]') || target.dataset?.noteId)) {
      lastRowSelection = { id, offset: target.selectionStart, end: target.selectionEnd, direction: target.selectionDirection, ...(target.dataset.noteId ? { field: 'note' } : {}) };
    }
  }
  root.addEventListener('click', onRowClick);
  root.addEventListener('focusout', onFocusOut);
  root.addEventListener('beforeinput', onBeforeInput);
  root.addEventListener('input', onInput);
  root.addEventListener('keydown', onKeyDown);
  if (!document.rows.length) {
    document = { ...document, rows: [createRow()] };
    onChange(document);
  }
  history.reset({ document, selection: null });
  render();
  return { ...context, destroy() {
    destroyed = true;
    unsubscribe();
    root.removeEventListener('click', onRowClick);
    root.removeEventListener('focusout', onFocusOut);
    root.removeEventListener('beforeinput', onBeforeInput);
    root.removeEventListener('input', onInput);
    root.removeEventListener('keydown', onKeyDown);
    root.remove();
  } };
}
