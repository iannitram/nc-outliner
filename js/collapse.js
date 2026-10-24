/** The visible preorder is independent of the stored tree: hidden rows stay in the file. */
export function visibleRows(rows, parentId = null, depth = 0) {
  return rows.flatMap((row) => [
    { row, parentId, depth },
    ...(row.collapsed ? [] : visibleRows(row.children ?? [], row.id, depth + 1)),
  ]);
}

function findRow(rows, id, parent = null) {
  for (const row of rows) {
    if (row.id === id) return { row, parent };
    const found = findRow(row.children ?? [], id, row);
    if (found) return found;
  }
  return null;
}

export function setCollapsed(document, id, collapsed) {
  const found = findRow(document.rows, id);
  if (!found || !found.row.children?.length || Boolean(found.row.collapsed) === collapsed) return document;
  function update(rows) {
    return rows.map((row) => {
      if (row.id === id) return { ...row, collapsed };
      const children = row.children ?? [];
      const updated = update(children);
      return updated.some((child, index) => child !== children[index]) ? { ...row, children: updated } : row;
    });
  }
  return { ...document, rows: update(document.rows) };
}

/** Resolve disclosure keys only at text boundaries; normal caret movement is left to the browser. */
export function disclosureAction(document, id, key, start, end, textLength) {
  const found = findRow(document.rows, id);
  if (!found || start !== end) return null;
  const { row, parent } = found;
  if (key === 'ArrowLeft' && start === 0) {
    if (row.children?.length && !row.collapsed) return { collapsed: true, id };
    if (parent) return { focus: parent.id, offset: parent.text.length };
  }
  if (key === 'ArrowRight' && end === textLength && row.children?.length) {
    if (row.collapsed) return { collapsed: false, id };
    return { focus: row.children[0].id, offset: 0 };
  }
  return null;
}

/** Optional editor hooks. All edits use context.change, so history and saving see them. */
export function createCollapseExtension() {
  return {
    shouldRenderChildren: (row) => !row.collapsed,
    onKeyDown(event, context) {
      if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey) return false;
      const input = event.target;
      const action = disclosureAction(context.getDocument(), input.dataset?.rowId, event.key,
        input.selectionStart, input.selectionEnd, input.value?.length);
      if (!action) return false;
      event.preventDefault();
      if (action.focus) context.focusRow(action.focus, action.offset);
      else context.change((document) => setCollapsed(document, action.id, action.collapsed), {
        type: 'collapse', selection: context.getSelection?.(),
        focus: { id: action.id, offset: input.selectionStart },
      });
      return true;
    },
    renderRow(row, li, context) {
      li.classList.add('outliner-disclosure-row');
      const dom = li.ownerDocument;
      const hasChildren = Boolean(row.children?.length);
      const disclosure = dom.createElement(hasChildren ? 'button' : 'span');
      disclosure.className = hasChildren ? 'ol-disclosure' : 'ol-bullet';
      const expanded = context.isExpanded?.(row) ?? !row.collapsed;
      disclosure.textContent = hasChildren ? (expanded ? '▾' : '▸') : '•';
      if (hasChildren) {
        disclosure.type = 'button';
        disclosure.setAttribute('aria-expanded', String(expanded));
        disclosure.setAttribute('aria-label', expanded ? 'Collapse row' : 'Expand row');
        disclosure.addEventListener('click', () => {
          if (context.isForcedExpanded?.(row.id)) {
            context.clearReveal?.(row.id);
            return;
          }
          context.change((document) => setCollapsed(document, row.id, !row.collapsed), {
            type: 'collapse', selection: context.getSelection?.(),
            focus: { id: row.id, offset: 0 },
          });
        });
      } else disclosure.setAttribute('aria-hidden', 'true');
      li.insertBefore(disclosure, li.firstChild);
    },
  };
}
