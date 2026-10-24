import { encodeOutlinePath } from './file-path.js';
const formats = {
  text: { extension: 'txt', type: 'text/plain;charset=utf-8' },
  markdown: { extension: 'md', type: 'text/markdown;charset=utf-8' },
  opml: { extension: 'opml', type: 'text/x-opml;charset=utf-8' },
};
const lines = value => String(value ?? '').replace(/\r\n?/g, '\n').split('\n');
const markdownText = value => value.replace(/[\\`*_{}\[\]<>#!|~]/g, '\\$&');

/** Exports all rows, including collapsed descendants and hidden notes. */
export function exportText(document, markdown = false) {
  const output = [];
  function visit(rows, depth = 0) {
    for (const row of rows) {
      const text = lines(row.text);
      const indent = markdown ? '  '.repeat(depth) : '\t'.repeat(depth);
      const escape = markdown ? markdownText : value => value;
      output.push(`${indent}${markdown ? '- ' : ''}${escape(text[0])}`);
      for (const continuation of text.slice(1)) output.push(`${indent}${markdown ? '  ' : '\t'}${escape(continuation)}`);
      if (row.note) for (const note of lines(row.note)) output.push(`${indent}${markdown ? '  > ' : '\t'}${escape(note)}`);
      visit(row.children ?? [], depth + 1);
    }
  }
  visit(document.rows);
  return output.length ? output.join('\n') + '\n' : '';
}

export function exportFilename(name, format) {
  if (!formats[format]) throw new Error('Unknown export format.');
  const stem = String(name || 'Outline').replace(/\.opml$/i, '').replace(/[\\/<>:"|?*\x00-\x1f\x7f]/g, '_').replace(/^\.+|[. ]+$/g, '').slice(0, 180) || 'Outline';
  return `${stem}.${formats[format].extension}`;
}

export async function prepareExport(current, format, api) {
  if (!current) throw new Error('Open an outline before exporting.');
  if (!formats[format]) throw new Error('Unknown export format.');
  // Snapshot before awaiting the server so concurrent edits cannot change this export.
  const document = structuredClone(current.document);
  const content = format === 'opml'
    ? (await api(`/${encodeOutlinePath(current.name)}/export`, 'POST', { document })).content
    : exportText(document, format === 'markdown');
  if (typeof content !== 'string') throw new Error('The export response was invalid.');
  return { content, filename: exportFilename(current.name, format), type: formats[format].type };
}

export function downloadExport(result, document = globalThis.document, urls = globalThis.URL) {
  const url = urls.createObjectURL(new Blob([result.content], { type: result.type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = result.filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Delay revocation until the browser has consumed the click navigation.
  setTimeout(() => urls.revokeObjectURL(url), 0);
}

export function mountExport(container, getCurrent, api, onError = () => {}, download = downloadExport) {
  const document = container.ownerDocument;
  const group = document.createElement('div');
  const select = document.createElement('select');
  select.setAttribute('aria-label', 'Export format');
  for (const [value, label] of [['text', 'Plain text'], ['opml', 'OPML'], ['markdown', 'Markdown']]) {
    const option = document.createElement('option'); option.value = value; option.textContent = label; select.append(option);
  }
  const button = document.createElement('button'); button.type = 'button'; button.textContent = 'Export outline';
  let busy = false;
  function refresh() { select.disabled = button.disabled = busy || !getCurrent(); }
  button.addEventListener('click', async () => {
    if (busy || !getCurrent()) return;
    busy = true; refresh();
    try { download(await prepareExport(getCurrent(), select.value, api)); }
    catch (error) { onError(error); }
    finally { busy = false; refresh(); }
  });
  group.append(select, button); container.append(group); refresh();
  return { refresh, destroy() { group.remove(); } };
}
