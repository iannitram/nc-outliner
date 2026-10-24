import { importOutline, mountImport } from './import.js';
import { mountExport } from './export.js';
import { mountTheme } from './theme.js';
import { createAutosave } from './autosave.js';
import { createRowLinkUrl, readRowLink } from './row-links.js';

/** File shell. F02 supplies editor.js; F01 can also display outlines read-only. */
export function createApi(base, fetcher = globalThis.fetch) {
  return async function request(path = '', method = 'GET', data, options = {}) {
    const response = await fetcher(`${base}/outlines${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', requesttoken: globalThis.OC?.requestToken ?? '', ...(data?.etag ? { 'If-Match': `"${data.etag}"` } : {}) },
      keepalive: options.keepalive ?? false,
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const result = await response.json();
    if (!response.ok) {
      const error = new Error(result.error || `Request failed (${response.status})`);
      error.status = response.status;
      throw error;
    }
    return result;
  };
}

export async function start(el, runtime = {}) {
  const doc = el.ownerDocument;
  const api = runtime.api ?? createApi(el.dataset.apiBase);
  const href = runtime.href ?? globalThis.location?.href;
  const clipboard = runtime.clipboard ?? globalThis.navigator?.clipboard;
  const rowLink = readRowLink(href);
  const make = (tag, text) => {
    const node = doc.createElement(tag);
    if (text !== undefined) node.textContent = text;
    return node;
  };
  const sidebar = make('aside');
  sidebar.className = 'outliner-files';
  const heading = make('h2', 'Outlines');
  const form = make('form');
  const name = make('input');
  name.placeholder = 'New outline name';
  name.setAttribute('aria-label', 'New outline name');
  name.required = true;
  const create = make('button', 'Create outline');
  create.type = 'submit';
  const list = make('div');
  const workspace = make('section');
  let toolbar = workspace;
  workspace.className = 'outliner-workspace';
  const title = make('h2', 'Choose or create an outline');
  const conflicts = make('div');
  conflicts.hidden = true;
  const reload = make('button', 'Reload');
  const copy = make('button', 'Keep mine as a copy');
  reload.type = copy.type = 'button';
  conflicts.append(reload, copy);
  let status = make('p');
  status.setAttribute('role', 'status');
  const content = make('div');
  form.append(name, create);
  sidebar.append(heading, form, list);
  workspace.append(title, conflicts, status, content);
  el.replaceChildren(sidebar, workspace);
  let importHost = sidebar;
  try {
    const { mountShell } = await import('./shell.js');
    const shell = mountShell(el);
    shell.navigation.append(heading, form, list);
    importHost = shell.navigation;
    toolbar = shell.toolbar;
    (runtime.mountTheme ?? mountTheme)(el, shell.toolbar);
    shell.toolbar.append(title, conflicts);
    shell.content.append(content);
    status = shell.status;
    status.setAttribute('role', 'status');
  } catch {
    // File foundation also works before the shared shell module is installed.
  }
  let current = null;
  let editor = null;
  let autosave = null;
  let busy = false;
  let mountEditor;
  try {
    ({ mountEditor } = await import('./editor.js'));
  } catch {
    // The outline-file foundation can display files before the editing module lands.
  }
  const exportControls = mountExport(toolbar, () => current ? {
    name: current.name, document: editor?.getDocument() ?? current.document,
  } : null, api, error => { status.textContent = error.message; });
  function controls() {
    exportControls.refresh();
    reload.disabled = copy.disabled = busy;
    create.disabled = busy;
    name.disabled = busy;
    list.querySelectorAll('button').forEach(button => { button.disabled = busy; });
  }
  const error = e => { status.textContent = e.message; };
  async function refresh() {
    const names = await api();
    list.replaceChildren();
    for (const filename of names) {
      const button = make('button', filename.slice(0, -5));
      button.type = 'button';
      button.addEventListener('click', () => open(filename).catch(error));
      list.append(button);
    }
    controls();
  }
  function display(result, linkedRowId = null) {
    autosave?.dispose();
    editor?.destroy();
    current = result;
    conflicts.hidden = true;
    autosave = createAutosave({
      document: result.document, etag: result.etag,
      save: (document, etag, options) => api(`/${encodeURIComponent(result.name)}`, 'PUT', { document, etag }, options),
      onStatus: text => { status.textContent = text; },
      onConflict: () => { conflicts.hidden = false; },
    });
    title.textContent = result.document.title || result.name;
    content.replaceChildren();
    status.textContent = 'Saved';
    if (mountEditor) {
      editor = mountEditor(content, result.document, (document) => {
        autosave.update(document);
        controls();
      }, {
        renderRowControls(row, item) {
          const button = make('button', 'Copy link');
          button.type = 'button';
          button.setAttribute('aria-label', `Copy link to row: ${row.text || 'Untitled row'}`);
          button.title = 'Copy a link to this row';
          button.addEventListener('mousedown', event => event.preventDefault());
          button.addEventListener('click', async () => {
            try {
              if (typeof clipboard?.writeText !== 'function') throw new Error('Clipboard unavailable');
              await clipboard.writeText(createRowLinkUrl(current.name, row.id, href));
              status.textContent = 'Row link copied.';
            } catch {
              status.textContent = 'Could not copy the row link. Check clipboard permissions and try again.';
            }
          });
          item.appendChild(button);
        },
      });
      if (linkedRowId && !editor.revealRow(linkedRowId)) status.textContent = 'The linked row was not found in this outline.';
    } else {
      const render = rows => {
        const ul = make('ul');
        for (const row of rows) {
          const li = make('li', row.text);
          if (row.children.length) li.append(render(row.children));
          ul.append(li);
        }
        return ul;
      };
      content.append(render(result.document.rows));
    }
    controls();
  }
  async function mayLeave() {
    await autosave?.flush();
    return !autosave?.hasPending() || globalThis.confirm('Discard unsaved changes?');
  }
  async function open(filename, linkedRowId = null) {
    if (busy) return;
    busy = true;
    controls();
    if (!await mayLeave()) { busy = false; controls(); return; }
    try { display(await api(`/${encodeURIComponent(filename)}`), linkedRowId); }
    finally { busy = false; controls(); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy) return;
    busy = true;
    controls();
    if (!await mayLeave()) { busy = false; controls(); return; }
    try {
      let filename = name.value.trim();
      if (!filename.toLowerCase().endsWith('.opml')) filename += '.opml';
      display(await api('', 'POST', { name: filename }));
      name.value = '';
      await refresh();
    } catch (e) { error(e); }
    finally { busy = false; controls(); }
  });
  reload.addEventListener('click', async () => {
    if (busy || !current) return;
    busy = true; controls();
    try { display(await api(`/${encodeURIComponent(current.name)}`)); }
    catch (e) { error(e); }
    finally { busy = false; controls(); }
  });
  copy.addEventListener('click', async () => {
    if (busy || !current) return;
    busy = true; controls();
    const snapshot = structuredClone(editor.getDocument());
    try {
      const result = await api(`/${encodeURIComponent(current.name)}/copy`, 'POST', { document: snapshot });
      const latest = structuredClone(editor.getDocument());
      display(result);
      if (JSON.stringify(latest) !== JSON.stringify(snapshot)) editor.replaceDocument(latest);
      await refresh();
    } catch (e) { error(e); }
    finally { busy = false; controls(); }
  });
  doc.addEventListener('visibilitychange', () => {
    if (doc.visibilityState === 'hidden') void autosave?.flush({ keepalive: true });
  });
  globalThis.addEventListener('pagehide', () => { void autosave?.flush({ keepalive: true }); });
  globalThis.addEventListener('beforeunload', event => {
    if (autosave?.hasPending()) {
      void autosave.flush({ keepalive: true });
      event.preventDefault(); event.returnValue = '';
    }
  });
  mountImport(importHost, async input => {
    if (busy) throw new Error('Wait for the current file operation to finish.');
    busy = true;
    controls();
    try {
      const result = await importOutline(api, input, mayLeave);
      if (!result) return null;
      display(result);
      await refresh();
      return result;
    } finally { busy = false; controls(); }
  });
  try { await refresh(); }
  catch (e) { error(e); }
  if (rowLink?.invalid) status.textContent = 'This row link is invalid.';
  else if (rowLink) {
    try {
      await open(rowLink.outline, rowLink.row);
    } catch (e) { error(e); }
  }
}
