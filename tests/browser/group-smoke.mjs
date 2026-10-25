// Real-DOM smoke for multi-selection grouping, ungrouping, caret and history.
// Run with Playwright available on NODE_PATH and Chromium at /usr/bin/chromium.
import { createServer } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const html = `<!doctype html><html><head><link rel="stylesheet" href="/css/outliner.css"></head>
<body><main id="editor"></main><script type="module">
import { mountEditor } from '/js/editor.js';
window.editor=mountEditor(document.querySelector('#editor'),{title:'Group smoke',rows:[
{id:'a',text:'Alpha',children:[]},
{id:'b',text:'Beta',children:[{id:'b1',text:'Child',children:[],custom:{keep:true}}]},
{id:'c',text:'Gamma',children:[]},
{id:'d',text:'Delta',children:[]},
]},()=>{});
</script></body></html>`;

const server = createServer(async (req, res) => {
  if (req.url === '/smoke.html') { res.writeHead(200, { 'Content-Type': 'text/html' }).end(html); return; }
  const path = resolve(root, `.${decodeURIComponent(req.url.split('?')[0])}`);
  if (!path.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
  try {
    const data = await readFile(path);
    const contentType = ({ '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType }).end(data);
  } catch { res.writeHead(404).end(); }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const page = await browser.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/smoke.html`);
  await page.getByRole('button', { name: 'Select row: Beta' }).click();
  await page.getByRole('button', { name: 'Select row: Gamma' }).click({ modifiers: ['Control'] });
  await page.locator('textarea[data-row-id="c"]').evaluate(input => { input.focus(); input.setSelectionRange(2, 4, 'backward'); });
  await page.getByRole('button', { name: 'Group selected', exact: true }).click();
  const grouped = await page.evaluate(() => {
    const rows = window.editor.getDocument().rows;
    const group = rows[1];
    return { rootIds: rows.map(row => row.id), childIds: group.children.map(row => row.id), metadata: group.children[0].children[0].custom.keep,
      focus: document.activeElement.dataset.rowId, start: document.activeElement.selectionStart, end: document.activeElement.selectionEnd, groupId: group.id };
  });
  if (grouped.rootIds.length !== 3 || grouped.childIds.join(',') !== 'b,c' || !grouped.metadata || grouped.focus !== 'c' || grouped.start !== 2 || grouped.end !== 4) {
    throw new Error(`Unexpected grouped result: ${JSON.stringify(grouped)}`);
  }
  await page.getByRole('button', { name: 'Select row: Untitled' }).click({ modifiers: ['Control'] });
  await page.getByRole('button', { name: 'Ungroup selected' }).click();
  const ungrouped = await page.evaluate(() => ({
    ids: window.editor.getDocument().rows.map(row => row.id),
    metadata: window.editor.getDocument().rows[1].children[0].custom.keep,
    focus: document.activeElement.dataset.rowId,
  }));
  if (ungrouped.ids.join(',') !== 'a,b,c,d' || !ungrouped.metadata || ungrouped.focus !== 'b') {
    throw new Error(`Unexpected ungrouped result: ${JSON.stringify(ungrouped)}`);
  }
  await page.getByRole('button', { name: 'Undo' }).click();
  if (await page.evaluate(() => window.editor.getDocument().rows[1].id) !== grouped.groupId) throw new Error('Undo did not restore the group.');
  await page.getByRole('button', { name: 'Redo' }).click();
  if ((await page.evaluate(() => window.editor.getDocument().rows.map(row => row.id).join(','))) !== 'a,b,c,d') throw new Error('Redo did not restore the ungrouped outline.');
  console.log(`Chromium group smoke passed: group ${grouped.childIds.join(',')} as ${grouped.groupId}; ungroup, undo and redo succeeded.`);
} finally {
  await browser.close();
  server.close();
}
