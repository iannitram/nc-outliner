/** Expand/collapse branches recursively, retaining leaves and extension data. */
export function setExpanded(document, expanded, id = null) {
  function update(rows, active = id === null) {
    let changed = false;
    const result = rows.map((row) => {
      const selected = active || row.id === id;
      if (!row.children?.length) return row;
      const children = update(row.children, selected);
      const collapsed = selected ? !expanded : row.collapsed;
      if (children === row.children && (!selected || Boolean(row.collapsed) === collapsed)) return row;
      changed = true;
      return { ...row, ...(selected ? { collapsed } : {}), children };
    });
    return changed ? result : rows;
  }
  const rows = update(document.rows);
  return rows === document.rows ? document : { ...document, rows };
}

/** A bulk collapse must not leave keyboard focus in a hidden descendant. */
export function visibleSelection(document, selection) {
  if (!selection) return null;
  function pathTo(rows, path = []) {
    for (const row of rows) {
      const next = [...path, row];
      if (row.id === selection.id) return next;
      const found = pathTo(row.children ?? [], next);
      if (found) return found;
    }
    return null;
  }
  const path = pathTo(document.rows);
  if (!path) return null;
  const ancestor = path.slice(0, -1).find((row) => row.collapsed);
  return ancestor ? { id: ancestor.id, offset: 0, end: 0, direction: 'none' } : selection;
}

export function applyExpansion(context, expanded, id = null, selection = context.getSelection()) {
  const previous = context.getDocument();
  const next = setExpanded(previous, expanded, id);
  if (next === previous) return false;
  return context.change(() => next, {
    type: id === null ? 'expand-all' : 'expand-subtree',
    selection,
    focus: visibleSelection(next, selection),
  });
}

export function handleExpansionKey(event, context) {
  if (!event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.isComposing) return false;
  if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return false;
  const id = event.target.dataset?.rowId;
  if (!id) return false;
  applyExpansion(context, event.key === 'ArrowRight', id);
  return true;
}

/** Visible controls complement subtree shortcuts and work with shared history. */
export function mountExpansionControls(toolbar, context, getSelection = context.getSelection) {
  const document = toolbar.ownerDocument;
  const buttons = [];
  for (const [label, expanded, subtree] of [
    ['Expand all', true, false], ['Collapse all', false, false],
    ['Expand row completely', true, true], ['Collapse row completely', false, true],
  ]) {
    const button = document.createElement('button');
    button.type = 'button';
    button.textContent = label;
    if (subtree) {
      const shortcut = expanded ? 'Alt+ArrowRight' : 'Alt+ArrowLeft';
      button.title = `${label} (${shortcut})`;
      button.setAttribute('aria-keyshortcuts', shortcut);
    }
    button.addEventListener('click', () => {
      const selection = getSelection();
      if (subtree && !selection) return;
      applyExpansion(context, expanded, subtree ? selection.id : null, selection);
    });
    toolbar.appendChild(button);
    buttons.push(button);
  }
  return buttons;
}
