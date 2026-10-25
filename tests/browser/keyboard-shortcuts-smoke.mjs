import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const project = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const types = { '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8' };
const server = createServer(async (request, response) => {
  const pathname = new URL(request.url, 'http://127.0.0.1').pathname;
  if (pathname === '/') {
    response.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    response.end('<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="/css/outliner.css"></head><body></body></html>');
    return;
  }
  const target = resolve(project, `.${decodeURIComponent(pathname)}`);
  if (!target.startsWith(`${project}${sep}`)) { response.writeHead(400).end(); return; }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[target.slice(target.lastIndexOf('.'))] ?? 'application/octet-stream' });
    response.end(body);
  } catch { response.writeHead(404).end(); }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium', args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.goto(`http://127.0.0.1:${server.address().port}/`);
  await page.evaluate(async () => {
    const { mountEditor } = await import('/js/editor.js');
    const host = document.createElement('div');
    Object.assign(host.style, { display: 'flex', width: '900px', height: '650px' });
    document.body.append(host);
    window.saved = [];
    window.editor = mountEditor(host, { title: 'Keyboard', showCheckboxes: false, rows: [
      { id: 'a', text: 'Alpha', children: [{ id: 'b', text: 'Child', children: [] }] },
      { id: 'c', text: 'Gamma', children: [] },
    ] }, doc => window.saved.push(structuredClone(doc)));
  });

  const row = id => page.locator(`textarea[data-row-id="${id}"]`);
  await row('a').focus();
  await row('a').press('Control+Shift+Enter');
  let ids = await page.evaluate(() => window.editor.getDocument().rows[0].children.map(item => item.id));
  assert.equal(ids.length, 2, 'add inside creates a child');
  const addedId = ids[1];
  assert.equal(await page.evaluate(() => window.editor.getDocument().rows[0].collapsed), false);
  await row(addedId).press('Control+Enter');
  ids = await page.evaluate(() => window.editor.getDocument().rows[0].children.map(item => item.id));
  assert.equal(ids.length, 3, 'add outside creates a sibling at the current level');

  await row('c').press('Tab');
  assert.equal(await page.evaluate(() => window.editor.getDocument().rows[0].children.at(-1).id), 'c', 'Tab moves right by indenting');
  await row('c').press('Shift+Tab');
  assert.equal(await page.evaluate(() => window.editor.getDocument().rows.at(-1).id), 'c', 'Shift+Tab moves left by outdenting');

  await row('a').press('Control+Shift+X');
  assert.equal(await page.evaluate(() => window.editor.getDocument().showCheckboxes), true);
  assert.equal(await page.evaluate(() => window.editor.getDocument().rows[0].checked), true);
  await row('a').press('Shift+Enter');
  const note = page.locator('textarea[data-note-id="a"]');
  await note.fill('Keyboard note');
  assert.equal(await page.evaluate(() => window.editor.getDocument().rows[0].note), 'Keyboard note');
  await note.press('Escape');
  assert.equal(await page.evaluate(() => document.activeElement.dataset.rowId), 'a');

  const beforeFocus = await page.evaluate(() => window.saved.length);
  await row('a').press('Alt+Shift+F');
  assert.equal(await page.locator('textarea[data-row-id]').count(), 4);
  assert.equal(await page.evaluate(() => window.saved.length), beforeFocus, 'focus is display state, not a document edit');
  await row('a').press('Alt+Shift+F');
  assert.equal(await page.locator('textarea[data-row-id]').count(), 5);
  assert.equal(await page.locator('.outliner-keyboard-help summary').textContent(), 'Keyboard shortcuts');
  assert.deepEqual(errors, []);
  console.log('Chromium keyboard smoke passed: add inside/outside, indent/outdent, checkbox, note editing, focus/unfocus, and keyboard help.');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
