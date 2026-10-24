/** Checklist settings are document edits, so toggling visibility and status is undoable. */
export function setCheckboxVisibility(document, visible) {
  if (Boolean(document.showCheckboxes) === visible) return document;
  return { ...document, showCheckboxes: visible };
}

/** Parent state is derived from every child, including collapsed/filtered descendants. */
export function checkboxState(row) {
  const children = row.children ?? [];
  if (!children.length) return row.checked ? 'checked' : 'unchecked';
  const states = children.map(checkboxState);
  if (states.every((state) => state === 'checked')) return 'checked';
  if (states.every((state) => state === 'unchecked')) return 'unchecked';
  return 'mixed';
}

export function setRowChecked(document, id, checked) {
  function subtree(row) {
    const children = (row.children ?? []).map(subtree);
    if (Boolean(row.checked) === checked && children.every((child, index) => child === row.children[index])) return row;
    return { ...row, checked, children };
  }
  function update(row) {
    if (row.id === id) return subtree(row);
    const children = (row.children ?? []).map(update);
    return children.some((child, index) => child !== row.children[index]) ? { ...row, children } : row;
  }
  const rows = document.rows.map(update);
  return rows.some((row, index) => row !== document.rows[index]) ? { ...document, rows } : document;
}

export function createCheckboxToggle(dom, context) {
  const button = dom.createElement('button');
  button.type = 'button';
  button.addEventListener('click', () => {
    context.change((document) => setCheckboxVisibility(document, !document.showCheckboxes), {
      type: 'checkbox-visibility', selection: context.getSelection(),
    });
  });
  return button;
}

export function updateCheckboxToggle(button, document) {
  button.textContent = document.showCheckboxes ? 'Hide checkboxes' : 'Show checkboxes';
  button.setAttribute('aria-pressed', String(Boolean(document.showCheckboxes)));
}

export function renderCheckbox(row, item, context) {
  if (!context.getDocument().showCheckboxes) return;
  const label = item.ownerDocument.createElement('label');
  label.className = 'outliner-check';
  const input = item.ownerDocument.createElement('input');
  input.type = 'checkbox';
  const state = checkboxState(row);
  input.checked = state === 'checked';
  input.indeterminate = state === 'mixed';
  input.setAttribute('aria-checked', state === 'mixed' ? 'mixed' : String(input.checked));
  input.setAttribute('aria-label', `Mark ${row.text || 'untitled row'} complete`);
  input.addEventListener('change', () => {
    context.change((document) => setRowChecked(document, row.id, input.checked), {
      type: 'checkbox', selection: context.getSelection(), focus: { id: row.id, offset: 0 },
    });
  });
  label.appendChild(input);
  item.insertBefore(label, item.firstChild);
  item.classList.add('outliner-check-row');
}
