/** A row's identity and extension data survive every editing operation. */
export function createRow(text = '') {
  return { id: globalThis.crypto?.randomUUID?.() ?? `row-${Date.now()}-${Math.random().toString(36).slice(2)}`, text, children: [], collapsed: false };
}

export function findRow(rows, id) {
  for (let index = 0; index < rows.length; index++) {
    const row = rows[index];
    if (row.id === id) return { row, siblings: rows, index };
    const found = findRow(row.children ?? [], id);
    if (found) return found;
  }
  return null;
}

export function flattenRows(rows) {
  return rows.flatMap((row) => [row, ...flattenRows(row.children ?? [])]);
}

export function flattenVisibleRows(rows) {
  return rows.flatMap((row) => [row, ...(row.collapsed ? [] : flattenVisibleRows(row.children ?? []))]);
}

export function updateText(document, id, text) {
  const found = findRow(document.rows, id);
  if (!found || found.row.text === text) return document;
  const next = structuredClone(document);
  findRow(next.rows, id).row.text = text;
  return next;
}

export function insertAfter(document, id) {
  if (!findRow(document.rows, id)) return { document, focus: null };
  const next = structuredClone(document);
  const found = findRow(next.rows, id);
  const row = createRow();
  found.siblings.splice(found.index + 1, 0, row);
  return { document: next, focus: { id: row.id, offset: 0 } };
}

export function deleteEmpty(document, id) {
  const original = findRow(document.rows, id);
  // Deleting a parent must never discard its children.
  if (!original || original.row.text !== '' || original.row.note || original.row.children?.length) return { document, focus: null };
  const ordered = flattenVisibleRows(document.rows);
  if (ordered.length === 1) return { document, focus: { id, offset: 0 } };
  const index = ordered.findIndex((row) => row.id === id);
  const destination = ordered[index - 1] ?? ordered[index + 1];
  const next = structuredClone(document);
  const found = findRow(next.rows, id);
  found.siblings.splice(found.index, 1);
  return { document: next, focus: { id: destination.id, offset: index > 0 ? destination.text.length : 0 } };
}
