import { encodeOutlinePath } from './file-path.js';
import { createRow } from './model.js';

/** Parse indented text and Markdown list markers without interpreting HTML. */
export function parseOutlineText(text, title = '', makeRow = createRow) {
  if (typeof text !== 'string' || new TextEncoder().encode(text).length > 1024 * 1024) {
    throw new Error('Import a text file smaller than 1 MB.');
  }
  if (/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/u.test(text)) throw new Error('The file contains unsupported control characters.');
  const rows = [];
  const stack = [];
  let count = 0;
  for (const line of text.replace(/^\uFEFF/u, '').split(/\r\n|\n|\r/u)) {
    if (!line.trim()) continue;
    if (++count > 10000) throw new Error('An import can contain at most 10,000 rows.');
    const prefix = line.match(/^[ \t]*/u)[0];
    const indent = [...prefix].reduce((column, char) => char === '\t' ? column + (4 - column % 4) : column + 1, 0);
    const content = line.slice(prefix.length).replace(/^(?:[-+*]|\d+[.)])\s+/u, '').trimEnd();
    if (!content) continue;
    while (stack.length && stack.at(-1).indent >= indent) stack.pop();
    if (stack.length >= 100) throw new Error('The imported outline is too deeply nested.');
    const row = makeRow(content);
    if (stack.length) stack.at(-1).row.children.push(row);
    else rows.push(row);
    stack.push({ indent, row });
  }
  if (!rows.length) throw new Error('Enter some outline text to import.');
  return { title, rows };
}

export function importFilename(name) {
  let filename = String(name ?? '').trim();
  if (!filename || filename.startsWith('.') || /[\\/\u0000-\u001f\u007f]/u.test(filename)) {
    throw new Error('Enter a new outline name without a path.');
  }
  if (!filename.toLowerCase().endsWith('.opml')) filename += '.opml';
  if (new TextEncoder().encode(filename).length > 240) throw new Error('The outline name is too long.');
  return filename;
}

/** Create only after validation and unsaved-change approval; never PUT an existing name. */
export async function importOutline(api, { name, text }, mayLeave = () => true) {
  const filename = importFilename(name);
  const document = parseOutlineText(text, filename.slice(0, -5));
  if (!await mayLeave()) return null;
  const created = await api('', 'POST', { name: filename });
  try {
    const saved = await api(`/${encodeOutlinePath(created.name)}`, 'PUT', { document, etag: created.etag });
    return { ...created, ...saved, document };
  } catch (error) {
    throw new Error(`Created ${created.name}, but could not save imported text: ${error.message}. Your source text is still in the import form.`, { cause: error });
  }
}

/** Reachable paste/file form; caller owns file switching and unsaved-change policy. */
export function mountImport(container, onImport) {
  const doc = container.ownerDocument;
  const make = (tag, text) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const details = make('details');
  details.className = 'outliner-import';
  const summary = make('summary', 'Import text or Markdown');
  const form = make('form');
  const name = make('input');
  name.required = true;
  name.placeholder = 'New outline name';
  name.setAttribute('aria-label', 'Imported outline name');
  const file = make('input');
  file.type = 'file';
  file.accept = '.txt,.md,.markdown,text/plain,text/markdown';
  file.setAttribute('aria-label', 'Text or Markdown file');
  const text = make('textarea');
  text.rows = 6;
  text.required = true;
  text.setAttribute('aria-label', 'Outline text to import');
  const submit = make('button', 'Import as new outline');
  submit.type = 'submit';
  const message = make('p');
  message.setAttribute('role', 'status');
  let busy = false;
  const controls = value => {
    busy = value;
    for (const control of [name, file, text, submit]) control.disabled = value;
  };
  file.addEventListener('change', async () => {
    if (busy || !file.files?.[0]) return;
    const selected = file.files[0];
    controls(true);
    try {
      if (selected.size > 1024 * 1024) throw new Error('Import a text file smaller than 1 MB.');
      text.value = await selected.text();
      if (!name.value.trim()) name.value = selected.name.replace(/\.(?:txt|md|markdown)$/iu, '');
      message.textContent = 'File loaded. Choose Import as new outline to continue.';
    } catch (error) { message.textContent = error.message; }
    finally { controls(false); }
  });
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    controls(true);
    message.textContent = 'Importing';
    try {
      const result = await onImport({ name: name.value, text: text.value });
      if (!result) { message.textContent = 'Import cancelled.'; return; }
      name.value = ''; text.value = ''; file.value = '';
      message.textContent = 'Imported';
      details.open = false;
    } catch (error) { message.textContent = error.message; }
    finally { controls(false); }
  });
  form.append(name, file, text, submit, message);
  details.append(summary, form);
  container.append(details);
  return { destroy: () => details.remove() };
}
