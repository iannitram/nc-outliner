import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

// Uses the session Playwright install and Chromium at /usr/bin/chromium.
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
  if (!target.startsWith(`${project}${sep}`)) {
    response.writeHead(400).end();
    return;
  }
  try {
    const body = await readFile(target);
    response.writeHead(200, { 'Content-Type': types[target.slice(target.lastIndexOf('.'))] ?? 'application/octet-stream' });
    response.end(body);
  } catch {
    response.writeHead(404).end();
  }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_PATH ?? '/usr/bin/chromium',
  args: ['--no-sandbox'],
});

try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/`);
  await page.evaluate(async () => {
    const { mountEditor } = await import('/js/editor.js');
    const host = document.createElement('div');
    host.id = 'host';
    Object.assign(host.style, { display: 'flex', width: '900px', height: '650px' });
    document.body.append(host);
    window.saved = [];
    window.editor = mountEditor(host, { title: 'Smoke', rows: [
      { id: 'a', text: 'Alpha', note: 'First note', children: [] },
      { id: 'b', text: 'Beta', note: 'Second note', children: [] },
    ] }, doc => window.saved.push(structuredClone(doc)));
  });

  const mode = page.getByLabel('Notes display');
  assert.equal(await page.locator('textarea[data-note-id]').count(), 2);
  await mode.click();
  await mode.press('ArrowDown');
  await mode.press('Enter');
  assert.equal(await page.evaluate(() => window.editor.getDocument().noteDisplayMode), 'bottom');
  assert.equal(await page.locator('textarea[data-note-id]').count(), 1);
  assert.equal(await page.locator('.outliner-note-pane textarea').inputValue(), 'First note');

  await page.locator('textarea[data-row-id="b"]').click();
  assert.match(await page.locator('.outliner-note-pane h2').textContent(), /Beta/);
  const note = page.locator('.outliner-note-pane textarea');
  await note.fill('Edited second note');
  assert.equal(await page.evaluate(() => window.editor.getDocument().rows[1].note), 'Edited second note');
  await page.getByRole('button', { name: 'Hide all notes' }).click();
  assert.equal(await page.locator('.outliner-note-pane textarea').count(), 0);
  assert.equal(await page.evaluate(() => window.editor.getDocument().rows[1].note), 'Edited second note');
  await page.getByRole('button', { name: 'Show all notes' }).click();
  assert.equal(await page.locator('.outliner-note-pane textarea').inputValue(), 'Edited second note');

  const layout = await page.evaluate(() => {
    const rows = document.querySelector('.outliner-row-area').getBoundingClientRect();
    const pane = document.querySelector('.outliner-note-pane').getBoundingClientRect();
    return { rowsBottom: rows.bottom, paneTop: pane.top };
  });
  assert.ok(layout.paneTop >= layout.rowsBottom - 1, JSON.stringify(layout));

  await mode.click();
  await mode.press('ArrowUp');
  await mode.press('Enter');
  assert.equal(await page.evaluate(() => window.editor.getDocument().noteDisplayMode), 'inline');
  assert.equal(await page.locator('textarea[data-note-id]').count(), 2);
  console.log('Chromium notes display smoke passed: native selector click/keyboard, row selection, pane editing, hide/show all, pane placement, inline return.');
} finally {
  await browser.close();
  await new Promise(resolveClose => server.close(resolveClose));
}
