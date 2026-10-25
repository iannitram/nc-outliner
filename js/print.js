const PRINT_CSS_SELECTOR = 'link[href*="/css/outliner.css"]';

/** Return a read-only print snapshot without changing the open editor document. */
export function collectPrintRows(document, options = {}, selectedIds = []) {
  const selected = new Set(selectedIds);
  const filter = options.checkedRows ?? 'all';
  const rows = [];
  function visit(children, depth = 0) {
    for (const row of children ?? []) {
      const includedBySelection = !options.selectedOnly || selected.has(row.id);
      const includedByCheck = filter === 'all' || Boolean(row.checked) === (filter === 'checked');
      if (includedBySelection && includedByCheck) rows.push({ id: row.id, text: String(row.text ?? ''), note: options.includeNotes ? String(row.note ?? '') : '', depth });
      if (options.expandAll !== false || !row.collapsed) visit(row.children, depth + 1);
    }
  }
  visit(document.rows);
  return rows;
}

function printSnapshot(sourceDocument, printWindow, options, selectedIds) {
  const target = printWindow.document;
  target.title = String(sourceDocument.title || 'Outline');
  const sourceStyle = globalThis.document?.querySelector(PRINT_CSS_SELECTOR);
  if (sourceStyle) {
    const link = target.createElement('link');
    link.rel = 'stylesheet';
    const url = new URL(sourceStyle.href);
    url.pathname = url.pathname.replace(/outliner\.css$/, 'print.css');
    link.href = url.href;
    target.head.append(link);
  }
  const root = target.createElement('main');
  root.className = 'outliner-print-document';
  const heading = target.createElement('h1');
  heading.textContent = String(sourceDocument.title || 'Outline');
  root.append(heading);
  const rows = collectPrintRows(sourceDocument, options, selectedIds);
  const list = target.createElement('ol');
  list.className = 'outliner-print-rows';
  for (const row of rows) {
    const item = target.createElement('li');
    if (!options.flattenIndentation) item.style.setProperty('--row-depth', String(row.depth));
    const text = target.createElement('div');
    text.className = 'outliner-print-text';
    text.textContent = row.text;
    item.append(text);
    if (row.note) {
      const note = target.createElement('div');
      note.className = 'outliner-print-note';
      note.textContent = row.note;
      item.append(note);
    }
    list.append(item);
  }
  root.append(list);
  target.body.replaceChildren(root);
}

/** Add a print-options dialog to an app toolbar. */
export function mountPrint(container, getCurrent, onError = () => {}) {
  const document = container.ownerDocument;
  const group = document.createElement('div');
  group.className = 'outliner-print-controls';
  const open = document.createElement('button');
  open.type = 'button';
  open.textContent = 'Print / Save as PDF';
  const dialog = document.createElement('dialog');
  dialog.className = 'outliner-print-dialog';
  dialog.setAttribute('aria-labelledby', 'outliner-print-title');
  const form = document.createElement('form');
  form.method = 'dialog';
  const heading = document.createElement('h2');
  heading.id = 'outliner-print-title';
  heading.textContent = 'Print options';
  form.append(heading);

  function checkbox(labelText, key, checked = false) {
    const label = document.createElement('label');
    const input = document.createElement('input');
    input.type = 'checkbox';
    input.name = key;
    input.checked = checked;
    label.append(input, document.createTextNode(` ${labelText}`));
    form.append(label);
    return input;
  }
  const expand = checkbox('Expand all rows', 'expandAll', true);
  const notes = checkbox('Include notes', 'includeNotes', true);
  const selectedOnly = checkbox('Selected rows only', 'selectedOnly');
  const selectedHint = document.createElement('p');
  selectedHint.className = 'outliner-print-hint';
  selectedHint.textContent = 'Select rows in the outline first.';
  form.append(selectedHint);
  const flatten = checkbox('Flatten indentation', 'flattenIndentation');
  const filterLabel = document.createElement('label');
  filterLabel.append(document.createTextNode('Checkbox rows: '));
  const checkedRows = document.createElement('select');
  checkedRows.name = 'checkedRows';
  for (const [value, text] of [['all', 'All rows'], ['checked', 'Checked rows only'], ['unchecked', 'Unchecked rows only']]) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    checkedRows.append(option);
  }
  filterLabel.append(checkedRows);
  form.append(filterLabel);
  const actions = document.createElement('div');
  actions.className = 'outliner-print-actions';
  const cancel = document.createElement('button');
  cancel.type = 'button';
  cancel.textContent = 'Cancel';
  cancel.addEventListener('click', () => dialog.close());
  const print = document.createElement('button');
  print.type = 'submit';
  print.value = 'print';
  print.textContent = 'Continue to print';
  actions.append(cancel, print);
  form.append(actions);
  dialog.append(form);
  group.append(open, dialog);
  container.append(group);

  function refresh() { open.disabled = !getCurrent(); }
  open.addEventListener('click', () => {
    const current = getCurrent();
    if (!current) return;
    const available = typeof current.getSelectedRowIds === 'function';
    selectedOnly.disabled = !available;
    selectedHint.hidden = available;
    dialog.showModal();
  });
  form.addEventListener('submit', event => {
    event.preventDefault();
    const current = getCurrent();
    if (!current) { dialog.close(); return; }
    const selectedIds = current.getSelectedRowIds?.() ?? [];
    const options = {
      expandAll: expand.checked,
      includeNotes: notes.checked,
      selectedOnly: selectedOnly.checked && !selectedOnly.disabled,
      flattenIndentation: flatten.checked,
      checkedRows: checkedRows.value,
    };
    const rows = collectPrintRows(current.document, options, selectedIds);
    if (!rows.length) {
      onError(new Error(options.selectedOnly ? 'Select at least one row to print.' : 'No rows match these print options.'));
      return;
    }
    let printWindow;
    try { printWindow = globalThis.open('', '_blank'); }
    catch (error) { onError(error); return; }
    if (!printWindow) { onError(new Error('Allow pop-ups to open the print view.')); return; }
    printWindow.opener = null;
    printSnapshot(current.document, printWindow, options, selectedIds);
    dialog.close();
    printWindow.focus();
    printWindow.setTimeout(() => printWindow.print(), 0);
  });
  refresh();
  return { refresh, destroy() { dialog.close(); group.remove(); } };
}
