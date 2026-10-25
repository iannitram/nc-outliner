import { createRow, findRow, flattenRows } from './model.js';
import { indentRow, outdentRow } from './indent.js';
import { moveRow } from './row-actions.js';

/** Transient row selection follows the displayed order, including search filtering. */
export function createRowSelection() {
  let ids = [];
  let anchor = null;
  let active = null;
  return {
    get: () => ({ ids: [...ids], anchor, active }),
    clear(id = null) { ids = []; anchor = active = id; },
    restore(selection) {
      ids = [...(selection?.rowIds ?? [])];
      anchor = selection?.rowAnchor ?? selection?.id ?? null;
      active = selection?.id ?? null;
    },
    reconcile(visible) {
      ids = ids.filter(id => visible.includes(id));
      if (!visible.includes(anchor)) anchor = ids[0] ?? null;
      if (!visible.includes(active)) active = ids.at(-1) ?? null;
    },
    select(id, { shift = false, toggle = false } = {}, visible) {
      if (!visible.includes(id)) return;
      if (shift) {
        if (!visible.includes(anchor)) anchor = visible.includes(active) ? active : id;
        const a = visible.indexOf(anchor), b = visible.indexOf(id);
        ids = visible.slice(Math.min(a,b), Math.max(a,b) + 1);
      } else if (toggle) {
        if (!ids.length && anchor && anchor !== id && visible.includes(anchor)) ids = [anchor];
        ids = ids.includes(id) ? ids.filter(value => value !== id) : [...ids, id];
        anchor = id;
      } else { ids = [id]; anchor = id; }
      active = id;
    },
  };
}

/** Structural actions operate on selected roots, moving descendants only once. */
export function selectedRootIds(document, ids) {
  const selected = new Set(ids);
  const result = [];
  function visit(rows) {
    for (const row of rows) {
      if (selected.has(row.id)) result.push(row.id);
      else visit(row.children ?? []);
    }
  }
  visit(document.rows);
  return result;
}

export function actOnRows(document, ids, action) {
  const selected = new Set(ids);
  if (!ids.length || !flattenRows(document.rows).some(row => selected.has(row.id))) return document;
  if (action === 'delete') {
    const prune = rows => rows.filter(row => !selected.has(row.id)).map(row => ({ ...row, children: prune(row.children ?? []) }));
    const rows = prune(document.rows);
    return { ...document, rows: rows.length ? rows : [createRow()] };
  }
  if (action === 'check' || action === 'uncheck') {
    const checked = action === 'check';
    let changed = !document.showCheckboxes;
    const update = rows => rows.map(row => {
      const children = update(row.children ?? []);
      if (selected.has(row.id) && Boolean(row.checked) !== checked) changed = true;
      return { ...row, children, ...(selected.has(row.id) ? { checked } : {}) };
    });
    const rows = update(document.rows);
    return changed ? { ...document, rows, showCheckboxes: true } : document;
  }
  const roots = selectedRootIds(document, ids);
  const rootSet = new Set(roots);
  let next = document;
  if (action === 'outdent' || action === 'down') roots.reverse();
  for (const id of roots) {
    const found = findRow(next.rows, id);
    if (action === 'indent') {
      const previous = found.siblings[found.index - 1];
      if (previous && !rootSet.has(previous.id)) next = indentRow(next, id);
    } else if (action === 'outdent') next = outdentRow(next, id);
    else if (action === 'up' || action === 'down') {
      const direction = action === 'up' ? -1 : 1;
      const neighbor = found.siblings[found.index + direction];
      if (neighbor && !rootSet.has(neighbor.id)) next = moveRow(next, id, direction);
    }
  }
  return next;
}

/** Grouping only accepts a contiguous sibling range so no rows silently reorder. */
export function canGroupSelectedRows(document, ids) {
  const roots = selectedRootIds(document, ids);
  if (!roots.length) return false;
  const locations = roots.map(id => findRow(document.rows, id));
  if (locations.some(location => !location) || !locations.every(location => location.siblings === locations[0].siblings)) return false;
  const indexes = locations.map(location => location.index).sort((a, b) => a - b);
  return indexes.at(-1) - indexes[0] + 1 === indexes.length;
}

/** Wrap selected roots in one new parent at the first selected row's position. */
export function groupSelectedRows(document, ids) {
  const roots = selectedRootIds(document, ids);
  if (!canGroupSelectedRows(document, ids)) return document;
  const selected = new Set(roots);
  const children = roots.map(id => findRow(document.rows, id)?.row).filter(Boolean);
  if (!children.length) return document;
  const firstId = roots[0];
  const group = { ...createRow(), children };
  let inserted = false;
  function transform(rows) {
    const result = [];
    let changed = false;
    for (const row of rows ?? []) {
      if (row.id === firstId) {
        result.push(group);
        inserted = true;
        changed = true;
      }
      if (selected.has(row.id)) { changed = true; continue; }
      const children = row.children ?? [];
      const nested = transform(children);
      if (nested !== children) changed = true;
      result.push(nested === children ? row : { ...row, children: nested });
    }
    return changed ? result : rows;
  }
  const rows = transform(document.rows);
  return inserted ? { ...document, rows } : document;
}

/** Remove selected parent rows and splice their children into their position. */
export function ungroupSelectedRows(document, ids) {
  const roots = selectedRootIds(document, ids);
  const groups = new Set(roots.filter(id => (findRow(document.rows, id)?.row.children ?? []).length));
  if (!groups.size) return document;
  function transform(rows) {
    const result = [];
    let changed = false;
    for (const row of rows ?? []) {
      if (groups.has(row.id)) {
        result.push(...row.children);
        changed = true;
        continue;
      }
      const children = row.children ?? [];
      const nested = transform(children);
      if (nested !== children) changed = true;
      result.push(nested === children ? row : { ...row, children: nested });
    }
    return changed ? result : rows;
  }
  return { ...document, rows: transform(document.rows) };
}
