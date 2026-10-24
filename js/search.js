/** IDs of literal text matches and their ancestors. Null means no filter. */
export function matchingRowIds(rows, query) {
  const needle = String(query).trim().toLocaleLowerCase();
  if (!needle) return null;
  const included = new Set();
  function visit(row) {
    const descendant = (row.children ?? []).map(visit).some(Boolean);
    const matches = String(row.text ?? '').toLocaleLowerCase().includes(needle);
    if (matches || descendant) included.add(row.id);
    return matches || descendant;
  }
  rows.forEach(visit);
  return included;
}
