const safeOutlineName = value => typeof value === 'string'
  && value.length <= 255
  && value.toLowerCase().endsWith('.opml')
  && !/[\\\u0000-\u001f\u007f]/u.test(value)
  && value.split('/').every(segment => segment.length > 0 && segment !== '.' && segment !== '..');
const safeRowId = value => typeof value === 'string'
  && value.length > 0
  && value.length <= 1024
  && !/[\u0000-\u001f\u007f]/u.test(value);

/** Make a same-page link using query parameters so names and IDs are URL encoded. */
export function createRowLinkUrl(outline, rowId, href = globalThis.location?.href) {
  if (!safeOutlineName(outline) || !safeRowId(rowId)) throw new TypeError('A valid outline and row are required.');
  const url = new URL(href || '/', globalThis.location?.origin || 'http://localhost');
  url.searchParams.set('outline', outline);
  url.searchParams.set('row', rowId);
  return url.href;
}

/** Return null when no row link was requested, or a safe parsed target/error. */
export function readRowLink(href = globalThis.location?.href) {
  if (!href) return null;
  let url;
  try { url = new URL(href, globalThis.location?.origin || 'http://localhost'); }
  catch { return { invalid: true }; }
  const outlines = url.searchParams.getAll('outline');
  const rows = url.searchParams.getAll('row');
  if (!outlines.length && !rows.length) return null;
  if (outlines.length !== 1 || rows.length !== 1 || !safeOutlineName(outlines[0]) || !safeRowId(rows[0])) return { invalid: true };
  return { outline: outlines[0], row: rows[0] };
}
