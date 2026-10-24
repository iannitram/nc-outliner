/** IDs of literal text matches and their ancestors. Null means no filter. */
export function matchingRowIds(rows, query) {
  if (!String(query).trim()) return null;
  const matchedIds = new Set(findMatches(rows, query).map(match => match.id));
  const included = new Set();
  function visit(row) {
    const descendant = (row.children ?? []).map(visit).some(Boolean);
    const matches = matchedIds.has(row.id);
    if (matches || descendant) included.add(row.id);
    return matches || descendant;
  }
  rows.forEach(visit);
  return included;
}

/** Stable preorder, then topic/note occurrence order. UTF-16 offsets match textareas. */
export function findMatches(rows, query) {
  const needle = String(query).trim();
  if (!needle) return [];
  const literal = needle.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const pattern = new RegExp(literal, 'giu');
  const matches = [];
  function visit(row) {
    for (const field of ['text', 'note']) {
      pattern.lastIndex = 0;
      for (const match of String(row[field] ?? '').matchAll(pattern)) {
        matches.push({ id: row.id, field, start: match.index, end: match.index + match[0].length });
      }
    }
    (row.children ?? []).forEach(visit);
  }
  rows.forEach(visit);
  return matches;
}

/** Text nodes only: source text never becomes HTML. */
export function renderMatchPreview(dom, text, matches, active) {
  const preview = dom.createElement('div');
  preview.className = 'outliner-find-preview';
  preview.setAttribute('aria-hidden', 'true');
  let offset = 0;
  for (const match of matches) {
    const before = dom.createElement('span');
    before.textContent = text.slice(offset, match.start);
    preview.appendChild(before);
    const mark = dom.createElement('mark');
    mark.textContent = text.slice(match.start, match.end);
    if (match === active) mark.className = 'outliner-find-current';
    preview.appendChild(mark);
    offset = match.end;
  }
  const after = dom.createElement('span');
  after.textContent = text.slice(offset);
  preview.appendChild(after);
  return preview;
}
