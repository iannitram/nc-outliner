import test from 'node:test';
import assert from 'node:assert/strict';
import { applyTheme, createThemeApi, mountTheme } from '../../js/theme.js';

function fixture(request) {
  class Element {
    constructor(tag) { this.tag = tag; this.children = []; this.dataset = {}; this.attributes = {}; this.listeners = {}; }
    append(...children) { children.forEach((child) => this.appendChild(child)); }
    appendChild(child) { child.parent = this; this.children.push(child); return child; }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(key, fn) { this.listeners[key] = fn; }
    removeEventListener(key) { delete this.listeners[key]; }
    remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
  }
  const root = new Element('div');
  root.ownerDocument = { createElement(tag) { return new Element(tag); } };
  const toolbar = new Element('header');
  const mounted = mountTheme(root, toolbar, { request });
  const [caption, select, status] = toolbar.children[0].children;
  return { root, toolbar, mounted, caption, select, status };
}

test('Auto removes overrides and lets live Nextcloud variables apply', () => {
  const root = { dataset: {} };
  applyTheme(root, 'dark'); assert.equal(root.dataset.outlinerTheme, 'dark');
  applyTheme(root, 'light'); assert.equal(root.dataset.outlinerTheme, 'light');
  applyTheme(root, 'auto'); assert.equal('outlinerTheme' in root.dataset, false);
  assert.throws(() => applyTheme(root, 'system'), /Unknown/);
});

test('theme API uses signed-in same-origin requests and persists only the appearance value', async () => {
  const calls = [];
  const request = createThemeApi('/apps/outliner/api', async (url, options) => {
    calls.push({ url, options });
    return { ok: true, json: async () => ({ theme: options.method === 'GET' ? 'auto' : 'dark' }) };
  });
  assert.equal(await request(), 'auto');
  assert.equal(await request('dark'), 'dark');
  assert.equal(calls[0].url, '/apps/outliner/api/theme');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.credentials, 'same-origin');
  assert.deepEqual(JSON.parse(calls[1].options.body), { theme: 'dark' });
  assert.equal(calls[1].options.method, 'PUT');
});

test('theme API rejects failed requests and malformed preference responses', async () => {
  const error = createThemeApi('/api', async () => ({ ok: false, json: async () => ({ error: 'Not signed in' }) }));
  await assert.rejects(error('dark'), /Not signed in/);
  const invalid = createThemeApi('/api', async () => ({ ok: true, json: async () => ({ theme: 'bogus' }) }));
  await assert.rejects(invalid(), /Invalid appearance/);
});

test('accessible selector loads server preference before enabling writes', async () => {
  let resolve;
  const f = fixture(() => new Promise((done) => { resolve = done; }));
  assert.equal(f.select.disabled, true);
  assert.equal(f.caption.textContent, 'Appearance');
  assert.equal(f.select.attributes['aria-label'], 'Appearance');
  assert.deepEqual(f.select.children.map((option) => option.value), ['auto', 'light', 'dark']);
  resolve('dark'); await f.mounted.ready;
  assert.equal(f.select.value, 'dark');
  assert.equal(f.root.dataset.outlinerTheme, 'dark');
  assert.equal(f.select.disabled, false);
});

test('selector persists changes and returning to Auto removes forced palette', async () => {
  const calls = [];
  const f = fixture(async (theme) => { calls.push(theme); return theme ?? 'light'; });
  await f.mounted.ready;
  f.select.value = 'auto'; await f.select.listeners.change();
  assert.deepEqual(calls, [undefined, 'auto']);
  assert.equal('outlinerTheme' in f.root.dataset, false);
  assert.equal(f.select.disabled, false);
  assert.equal(f.status.textContent, '');
});

test('failed writes restore previously saved palette and expose retryable error', async () => {
  const f = fixture(async (theme) => { if (theme) throw new Error('Offline'); return 'dark'; });
  await f.mounted.ready;
  f.select.value = 'light'; await f.select.listeners.change();
  assert.equal(f.root.dataset.outlinerTheme, 'dark');
  assert.equal(f.select.value, 'dark');
  assert.equal(f.select.disabled, false);
  assert.match(f.status.textContent, /Unable to save/);
});

test('failed preference load stays Auto and leaves selector usable for retry', async () => {
  const f = fixture(async () => { throw new Error('Offline'); });
  await f.mounted.ready;
  assert.equal('outlinerTheme' in f.root.dataset, false);
  assert.equal(f.select.disabled, false);
  assert.match(f.status.textContent, /Unable to load/);
});

test('destroy prevents a pending load from changing detached UI or app palette', async () => {
  let resolve;
  const f = fixture(() => new Promise((done) => { resolve = done; }));
  f.mounted.destroy(); resolve('dark'); await f.mounted.ready;
  assert.equal(f.toolbar.children.length, 0);
  assert.equal('outlinerTheme' in f.root.dataset, false);
  assert.equal(f.select.listeners.change, undefined);
});
