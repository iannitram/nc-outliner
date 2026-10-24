import { findRow } from './model.js';
export const formats = ['bold', 'italic', 'underline', 'strikethrough'];
export const formatField = (field) => (field === 'note' ? 'noteFormats' : 'textFormats');

/** Canonical disjoint UTF-16 ranges containing only supported marks; never HTML. */
export function normalizeFormats(ranges = [], length = 0) {
  const valid = ranges.filter(
    (r) =>
      Number.isInteger(r.start) &&
      Number.isInteger(r.end) &&
      r.start >= 0 &&
      r.end > r.start &&
      r.end <= length &&
      Array.isArray(r.marks),
  );
  const points = [...new Set(valid.flatMap((r) => [r.start, r.end]))].sort((a, b) => a - b),
    result = [];
  for (let i = 1; i < points.length; i++) {
    const start = points[i - 1],
      end = points[i];
    const marks = formats.filter((mark) =>
      valid.some((r) => r.start <= start && r.end >= end && r.marks.includes(mark)),
    );
    if (!marks.length) continue;
    const last = result.at(-1);
    if (last?.end === start && String(last.marks) === String(marks)) last.end = end;
    else result.push({ start, end, marks });
  }
  return result;
}
export function toggleFormat(document, selection, mark) {
  const row = selection && findRow(document.rows, selection.id)?.row;
  if (!row || !formats.includes(mark)) return document;
  const field = selection.field === 'note' ? 'note' : 'text',
    key = formatField(field),
    text = row[field] ?? '';
  const start = Math.max(0, Math.min(selection.offset, text.length)),
    end = Math.max(start, Math.min(selection.end ?? start, text.length));
  if (start === end) return document;
  const ranges = normalizeFormats(row[key], text.length);
  const remove =
    ranges
      .filter((r) => r.end > start && r.start < end && r.marks.includes(mark))
      .reduce((n, r) => n + Math.min(end, r.end) - Math.max(start, r.start), 0) ===
    end - start;
  const points = [...new Set([0, text.length, start, end, ...ranges.flatMap((r) => [r.start, r.end])])].sort(
      (a, b) => a - b,
    ),
    changed = [];
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1],
      b = points[i];
    let marks = ranges.find((r) => r.start <= a && r.end >= b)?.marks ?? [];
    if (a >= start && b <= end) marks = remove ? marks.filter((m) => m !== mark) : [...new Set([...marks, mark])];
    changed.push({ start: a, end: b, marks });
  }
  const next = structuredClone(document);
  findRow(next.rows, row.id).row[key] = normalizeFormats(changed, text.length);
  return next;
}
/** Rebase ranges after text edits; inserted text inherits the marks at the caret. */
export function rebaseFormats(ranges, oldText, newText, edit) {
  let start = 0,
    end = oldText.length,
    inserted;
  if (
    edit &&
    Number.isInteger(edit.offset) &&
    Number.isInteger(edit.end) &&
    oldText.slice(0, edit.offset) === newText.slice(0, edit.offset) &&
    oldText.slice(edit.end) === newText.slice(newText.length - (oldText.length - edit.end))
  ) {
    start = edit.offset;
    end = edit.end;
    inserted = newText.length - oldText.length + end - start;
  }
  if (inserted === undefined || inserted < 0) {
    while (start < Math.min(oldText.length, newText.length) && oldText[start] === newText[start]) start++;
    while (end > start && oldText[end - 1] === newText[newText.length - (oldText.length - end) - 1]) end--;
    inserted = newText.length - oldText.length + end - start;
  }
  const delta = inserted - (end - start),
    output = [],
    normalized = normalizeFormats(ranges, oldText.length);
  const active =
    (start === end ? normalized.find((r) => r.start < start && r.end >= start) : null) ??
    normalized.find((r) => r.start <= start && r.end > start);
  for (const r of normalized) {
    if (r.start < start) output.push({ ...r, end: Math.min(r.end, start) });
    if (r.end > end) output.push({ ...r, start: Math.max(r.start, end) + delta, end: r.end + delta });
  }
  if (inserted && active) output.push({ start, end: start + inserted, marks: active.marks });
  return normalizeFormats(output, newText.length);
}
export function applyFormat(context, selection, mark) {
  if (!selection) return false;
  return context.change((doc) => toggleFormat(doc, selection, mark), { type: 'format', selection, focus: selection });
}
export function mountFormattingControls(toolbar, context, getTarget) {
  for (const mark of formats) {
    const button = toolbar.ownerDocument.createElement('button');
    button.type = 'button';
    button.textContent = mark[0].toUpperCase() + mark.slice(1);
    button.setAttribute('title', 'Select text in a row or note, then toggle ' + mark);
    button.addEventListener('mousedown', (event) => event.preventDefault());
    button.addEventListener('click', () => applyFormat(context, getTarget(), mark));
    toolbar.appendChild(button);
  }
}
export function formatCommand(event) {
  if (!(event.ctrlKey || event.metaKey) || event.altKey || event.isComposing) return null;
  const key = event.key.toLowerCase();
  return event.shiftKey
    ? key === 'x'
      ? 'strikethrough'
      : null
    : ({ b: 'bold', i: 'italic', u: 'underline' }[key] ?? null);
}
