import { importOutline, mountImport } from './import.js';

/** File shell. F02 supplies editor.js; F01 can also display outlines read-only. */
export function createApi(base, fetcher = globalThis.fetch) {
  return async function request(path = '', method = 'GET', data) {
    const response = await fetcher(`${base}/outlines${path}`, {
      method,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', requesttoken: globalThis.OC?.requestToken ?? '' },
      ...(data === undefined ? {} : { body: JSON.stringify(data) }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.error || `Request failed (${response.status})`);
    return result;
  };
}

export async function start(el) {
  const doc = el.ownerDocument;
  const api = createApi(el.dataset.apiBase);
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
  workspace.className = 'outliner-workspace';
  const title = make('h2', 'Choose or create an outline');
  const save = make('button', 'Save');
  save.type = 'button';
  save.disabled = true;
  let status = make('p');
  status.setAttribute('role', 'status');
  const content = make('div');
  form.append(name, create);
  sidebar.append(heading, form, list);
  workspace.append(title, save, status, content);
  el.replaceChildren(sidebar, workspace);
  let importHost = sidebar;
  try {
    const { mountShell } = await import('./shell.js');
    const shell = mountShell(el);
    shell.navigation.append(heading, form, list);
    importHost = shell.navigation;
    shell.toolbar.append(title, save);
    shell.content.append(content);
    status = shell.status;
    status.setAttribute('role', 'status');
  } catch {
    // File foundation also works before the shared shell module is installed.
  }
  let current = null;
  let editor = null;
  let dirty = false;
  let busy = false;
  let mountEditor;
  try {
    ({ mountEditor } = await import('./editor.js'));
  } catch {
    // The outline-file foundation can display files before the editing module lands.
  }
  function controls() {
    save.disabled = !current || !dirty || busy;
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
  function display(result) {
    editor?.destroy();
    current = result;
    dirty = false;
    title.textContent = result.document.title || result.name;
    content.replaceChildren();
    if (mountEditor) {
      editor = mountEditor(content, result.document, () => {
        dirty = true;
        status.textContent = 'Unsaved changes';
        controls();
      });
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
    status.textContent = 'Opened';
    controls();
  }
  function mayLeave() {
    return !dirty || globalThis.confirm('Discard unsaved changes?');
  }
  async function open(filename) {
    if (busy || !mayLeave()) return;
    busy = true;
    controls();
    try { display(await api(`/${encodeURIComponent(filename)}`)); }
    finally { busy = false; controls(); }
  }
  form.addEventListener('submit', async event => {
    event.preventDefault();
    if (busy || !mayLeave()) return;
    busy = true;
    controls();
    try {
      let filename = name.value.trim();
      if (!filename.toLowerCase().endsWith('.opml')) filename += '.opml';
      display(await api('', 'POST', { name: filename }));
      name.value = '';
      await refresh();
    } catch (e) { error(e); }
    finally { busy = false; controls(); }
  });
  save.addEventListener('click', async () => {
    if (busy || !current || !dirty) return;
    busy = true;
    controls();
    const document = structuredClone(editor.getDocument());
    status.textContent = 'Saving';
    try {
      const result = await api(`/${encodeURIComponent(current.name)}`, 'PUT', { document, etag: current.etag });
      current.etag = result.etag;
      // Keep edits made while the request was in flight marked as unsaved.
      dirty = JSON.stringify(document) !== JSON.stringify(editor.getDocument());
      status.textContent = dirty ? 'Unsaved changes' : 'Saved';
    } catch (e) { error(e); }
    finally { busy = false; controls(); }
  });
  globalThis.addEventListener('beforeunload', event => {
    if (dirty) { event.preventDefault(); event.returnValue = ''; }
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
}
