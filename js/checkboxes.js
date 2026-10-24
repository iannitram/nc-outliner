/** Checklist settings are document edits, so toggling visibility and status is undoable. */
export function setCheckboxVisibility(document, visible) {
  if (Boolean(document.showCheckboxes) === visible) return document;
  return { ...document, showCheckboxes: visible };
}

export function setRowChecked(document, id, checked) {
  let changed = false;
  function update(rows) {
    return rows.map((row) => {
      if (row.id === id) {
        if (Boolean(row.checked) === checked) return row;
        changed = true;
        return { ...row, checked };
      }
      const children = update(row.children ?? []);
      return children.some((child, index) => child !== row.children[index]) ? { ...row, children } : row;
    });
  }
  const rows = update(document.rows);
  return changed ? { ...document, rows } : document;
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
  input.checked = Boolean(row.checked);
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
