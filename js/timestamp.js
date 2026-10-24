import { findRow } from './model.js';

export const timestampFormats = [
  ['date-short', 'Short date'], ['date-long', 'Long date'], ['time', 'Time'],
  ['date-time-short', 'Short date and time'], ['date-time-long', 'Long date and time'],
];

/** Browser locale and timezone by default; injectable values keep tests deterministic. */
export function formatTimestamp(kind, { date = new Date(), locale, timeZone } = {}) {
  const styles = {
    'date-short': { dateStyle: 'short' }, 'date-long': { dateStyle: 'long' },
    time: { timeStyle: 'short' },
    'date-time-short': { dateStyle: 'short', timeStyle: 'short' },
    'date-time-long': { dateStyle: 'long', timeStyle: 'short' },
  };
  if (!styles[kind]) throw new RangeError('Unknown timestamp format');
  return new Intl.DateTimeFormat(locale, { ...styles[kind], ...(timeZone ? { timeZone } : {}) }).format(date);
}

/** Replace the selected text without changing row identities or extension data. */
export function insertTimestamp(document, selection, text) {
  const row = selection && findRow(document.rows, selection.id)?.row;
  if (!row) return { document, focus: null };
  const field = selection.field === 'note' ? 'note' : 'text';
  const old = row[field] ?? '';
  const start = Math.max(0, Math.min(selection.offset ?? old.length, old.length));
  const end = Math.max(start, Math.min(selection.end ?? start, old.length));
  const next = structuredClone(document);
  findRow(next.rows, row.id).row[field] = old.slice(0, start) + text + old.slice(end);
  return { document: next, focus: { id: row.id, offset: start + text.length, end: start + text.length, direction: 'none', ...(field === 'note' ? { field: 'note' } : {}) } };
}

export function mountTimestampControls(toolbar, context, getTarget, settings = {}) {
  const dom = toolbar.ownerDocument;
  const select = dom.createElement('select');
  select.setAttribute('aria-label', 'Timestamp format');
  for (const [value, label] of timestampFormats) {
    const option = dom.createElement('option');
    option.value = value; option.textContent = label;
    select.appendChild(option);
  }
  select.value = 'date-short';
  const button = dom.createElement('button');
  button.type = 'button';
  button.textContent = 'Insert timestamp';
  button.setAttribute('title', 'Insert into the last selected row or note');
  button.addEventListener('click', () => {
    const selection = getTarget();
    if (!selection) return;
    const result = insertTimestamp(context.getDocument(), selection, formatTimestamp(select.value, settings));
    if (result.focus) context.change(() => result.document, { type: 'timestamp', selection, focus: result.focus });
  });
  toolbar.appendChild(select);
  toolbar.appendChild(button);
  return { select, button };
}
