// Chromium smoke for the print-options dialog and browser PDF rendering.
// Run with Playwright available on NODE_PATH and Chromium at /usr/bin/chromium.
import { createServer } from 'node:http';
import { readFile, writeFile } from 'node:fs/promises';
import { extname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const { chromium } = require('playwright');
const root = resolve(fileURLToPath(new URL('../..', import.meta.url)));
const outputPath = process.argv[2] || '/tmp/nc-outliner-print-smoke.pdf';
const html = `<!doctype html><html><head>
<link rel="stylesheet" href="/css/outliner.css"><link rel="stylesheet" href="/css/print.css">
</head><body><main id="toolbar"></main><script type="module">
import { mountPrint } from '/js/print.js';
const current={document:{title:'Print smoke',rows:[{id:'a',text:'A <img src=x onerror=alert(1)>',note:'Note text',checked:true,collapsed:true,children:[{id:'b',text:'Nested row',checked:false,children:[]}]}]},getSelectedRowIds:()=>['b']};
mountPrint(document.querySelector('#toolbar'),()=>current,e=>{document.body.dataset.error=e.message});
</script></body></html>`;

const server = createServer(async (req, res) => {
  if (req.url === '/smoke.html') {
    res.writeHead(200, { 'Content-Type': 'text/html' }).end(html);
    return;
  }
  const path = resolve(root, `.${decodeURIComponent(req.url.split('?')[0])}`);
  if (!path.startsWith(`${root}/`)) { res.writeHead(403).end(); return; }
  try {
    const contentType = ({ '.js': 'text/javascript', '.css': 'text/css' })[extname(path)] || 'application/octet-stream';
    const data = await readFile(path);
    res.writeHead(200, { 'Content-Type': contentType }).end(data);
  } catch { res.writeHead(404).end(); }
});

await new Promise(resolveListen => server.listen(0, '127.0.0.1', resolveListen));
const address = server.address();
const browser = await chromium.launch({ executablePath: process.env.CHROMIUM_BIN || '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
try {
  const context = await browser.newContext();
  await context.addInitScript(() => { window.print = () => { window.__nativePrintCalled = true; }; });
  const page = await context.newPage();
  await page.goto(`http://127.0.0.1:${address.port}/smoke.html`);
  await page.getByRole('button', { name: 'Print / Save as PDF' }).click();
  await page.getByLabel('Flatten indentation').check();
  await page.getByLabel('Selected rows only').check();
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Continue to print' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('domcontentloaded');
  await popup.waitForFunction(() => window.__nativePrintCalled === true);
  const result = await popup.evaluate(() => ({
    title: document.title,
    text: document.body.innerText,
    images: document.images.length,
    rows: document.querySelectorAll('.outliner-print-rows > li').length,
  }));
  if (result.rows !== 1 || result.images !== 0 || !result.text.includes('Nested row')) {
    throw new Error(`Unexpected print view: ${JSON.stringify(result)}`);
  }
  const cdp = await context.newCDPSession(popup);
  const pdf = await cdp.send('Page.printToPDF', { printBackground: true });
  const bytes = Buffer.from(pdf.data, 'base64');
  if (!bytes.subarray(0, 5).equals(Buffer.from('%PDF-'))) throw new Error('Chromium did not return a PDF.');
  await writeFile(outputPath, bytes);
  console.log(`Chromium print smoke passed: ${outputPath} (${bytes.length} bytes)`);
} finally {
  await browser.close();
  server.close();
}
