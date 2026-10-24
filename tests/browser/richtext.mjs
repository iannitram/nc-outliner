// Optional real-browser regression: npm install --no-save outside this checkout playwright,
// then make it available through NODE_PATH. CHROMIUM_BIN selects an installed Chromium.
import { createRequire } from 'node:module';
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const { chromium } = createRequire(import.meta.url)('playwright');
const root = fileURLToPath(new URL('../../', import.meta.url));
const server = createServer(async (req, res) => {
  if (req.url === '/') {
    res.setHeader('Content-Type', 'text/html');
    res.end(
      '<link rel="stylesheet" href="/css/outliner.css"><div id="editor"></div><script type="module">import {mountEditor} from "/js/editor.js";window.changes=[];window.editor=mountEditor(document.querySelector("#editor"),{title:"Test",rows:[{id:"a",text:"Alpha beta",note:"Note text",children:[]}]},doc=>changes.push(doc));</script>',
    );
    return;
  }
  try {
    const path = new URL(req.url, 'http://local').pathname;
    if (!/^\/(js|css)\/[a-z-]+\.(js|css)$/.test(path)) throw Error();
    res.setHeader('Content-Type', path.endsWith('.js') ? 'text/javascript' : 'text/css');
    res.end(await readFile(root + path));
  } catch {
    res.statusCode = 404;
    res.end();
  }
});
await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const browser = await chromium.launch({
  executablePath: process.env.CHROMIUM_BIN ?? '/usr/bin/chromium',
  headless: true,
  args: ['--no-sandbox'],
});
try {
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForFunction(() => !!window.editor);
  const topic = '[data-rich-input][data-row-id="a"]',
    note = '[data-note-id="a"]';
  await page.evaluate(() => editor.focusRow('a', 0, 5));
  await page.getByRole('button', { name: 'Bold', exact: true }).click();
  assert.equal(await page.locator(topic + ' .outliner-format-bold').textContent(), 'Alpha');
  await page.evaluate(() => editor.focusRow('a', 1, 4, 'backward'));
  await page.keyboard.press('Control+i');
  assert.deepEqual(await page.evaluate(() => editor.getDocument().rows[0].textFormats), [
    { start: 0, end: 1, marks: ['bold'] },
    { start: 1, end: 4, marks: ['bold', 'italic'] },
    { start: 4, end: 5, marks: ['bold'] },
  ]);
  await page.keyboard.type('XYZ');
  assert.equal(await page.evaluate(() => editor.getDocument().rows[0].text), 'AXYZa beta');
  assert.equal(await page.locator(topic + ' .outliner-format-italic').textContent(), 'XYZ');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+z');
  assert.equal(await page.locator(topic).textContent(), 'Alpha beta');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Control+Shift+z');
  assert.equal(await page.locator(topic).textContent(), 'AXYZa beta');
  await page.evaluate(() => editor.focusRow('a', 0, 4, 'backward', 'note'));
  await page.getByRole('button', { name: 'Underline', exact: true }).focus();
  await page.keyboard.press('Enter');
  await page.keyboard.press('Control+Shift+x');
  assert.equal(
    await page.locator(note + ' .outliner-format-strikethrough.outliner-format-underline').textContent(),
    'Note',
  );
  // Paste includes hostile HTML; the editor accepts only the clipboard's plain text.
  await page.evaluate(() => {
    editor.focusRow('a', 9, 9, 'none', 'note');
    const dt = new DataTransfer();
    dt.setData('text/plain', '\n<img src=x onerror=alert(1)>');
    dt.setData('text/html', '<img src=x onerror=alert(1)>');
    document.activeElement.dispatchEvent(
      new ClipboardEvent('paste', { bubbles: true, cancelable: true, clipboardData: dt }),
    );
  });
  assert.equal(await page.locator('img').count(), 0);
  assert.match(await page.evaluate(() => editor.getDocument().rows[0].note), /\n<img/);
  await page.keyboard.press('Enter');
  await page.keyboard.type('second line');
  assert.match(await page.evaluate(() => editor.getDocument().rows[0].note), /\nsecond line/);
  // Emulate reopening the saved JSON, then ensure annotations and literal markup survive.
  const snapshot = await page.evaluate(() => JSON.parse(JSON.stringify(changes.at(-1))));
  await page.evaluate((doc) => editor.replaceDocument(doc), snapshot);
  assert.equal(
    await page
      .locator(note + ' .outliner-format-underline')
      .first()
      .textContent(),
    'Note',
  );
  assert.equal(await page.locator('img').count(), 0);
  assert.deepEqual(errors, []);
  console.log(
    'PASS browser: topic/note marks, backward selection, keyboard/toolbar, typing, undo/redo, hostile paste, multiline, saved snapshot reload',
  );
} finally {
  await browser.close();
  await new Promise((resolve) => server.close(resolve));
}
