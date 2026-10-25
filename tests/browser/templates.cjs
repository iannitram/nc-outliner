const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const { spawn } = require('node:child_process');

(async () => {
  const server = spawn('python3', ['-m', 'http.server', '4179', '--bind', '127.0.0.1'], { cwd: process.cwd(), stdio: 'ignore' });
  const browser = await chromium.launch({ executablePath: '/usr/bin/chromium', headless: true, args: ['--no-sandbox'] });
  try {
    const page = await browser.newPage();
    page.on('pageerror', error => console.error('browser error:', error.message));
    page.on('console', message => { if (message.type() === 'error') console.error('browser console:', message.text()); });
    page.on('response', response => { if (response.status() >= 400) console.error('browser response:', response.status(), response.url()); });
    const current = { title: 'Current', rows: [{ id: 'topic', text: 'Starting topic', children: [] }] };
    const templates = [];
    const actions = [];
    page.on('dialog', dialog => dialog.accept('New sprint'));
    await page.route('**/apps/outliner/api/**', async route => {
      const request = route.request();
      const path = new URL(request.url()).pathname.replace('/apps/outliner/api', '');
      const json = request.postDataJSON?.() ?? {};
      actions.push([request.method(), path, json]);
      let body = {};
      if (request.method() === 'GET' && path === '/theme') body = { theme: 'auto' };
      else if (request.method() === 'PUT' && path === '/theme') body = json;
      else if (request.method() === 'GET' && path === '/outlines') body = ['Current.opml'];
      else if (request.method() === 'GET' && path === '/templates') body = templates.map(t => t.name);
      else if (request.method() === 'GET' && path === '/outlines/Current.opml') body = { name: 'Current.opml', etag: 'v1', document: structuredClone(current) };
      else if (request.method() === 'PUT' && path === '/outlines/Current.opml') {
        Object.assign(current, structuredClone(json.document)); body = { name: 'Current.opml', etag: 'v2' };
      } else if (request.method() === 'POST' && path === '/templates') {
        templates.push({ name: json.name, document: structuredClone(json.document) });
        body = { name: json.name, document: structuredClone(json.document) };
      } else if (request.method() === 'POST' && path === '/templates/Meeting.opml/outlines') {
        const source = templates.find(t => t.name === 'Meeting.opml');
        body = { name: 'New sprint.opml', etag: 'v3', document: { ...structuredClone(source.document), title: 'New sprint' } };
      } else {
        return route.fulfill({ status: 404, contentType: 'application/json', body: JSON.stringify({ error: `Unexpected ${request.method()} ${path}` }) });
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(body) });
    });
    await page.goto('http://127.0.0.1:4179/tests/browser/templates.html');
    await page.getByRole('button', { name: 'Current', exact: true }).click();
    await page.waitForTimeout(300);
    const row = page.locator('textarea[data-row-id="topic"]');
    await row.fill('Unsaved draft topic');
    await page.getByLabel('Template name').fill('Meeting');
    await page.getByRole('button', { name: 'Save current as template' }).click();
    await page.getByText('Template saved').waitFor();
    assert.equal(templates.length, 1);
    assert.equal(templates[0].document.rows[0].text, 'Unsaved draft topic');
    assert.equal(current.rows[0].text, 'Starting topic', 'saving the template must not write the source outline');
    await page.getByRole('button', { name: 'New from Meeting' }).click();
    await page.getByText('New sprint', { exact: true }).waitFor();
    assert.equal(templates[0].document.title, 'Current', 'creating an outline must leave the template unchanged');
    assert.equal(actions.some(([method, path]) => method === 'POST' && path === '/templates/Meeting.opml/outlines'), true);
    assert.equal(actions.some(([method, path]) => method === 'PUT' && path === '/outlines/Current.opml'), true, 'the normal unsaved-change barrier must save before switching');
    console.log('PASS browser template flow: unsaved snapshot saved, source untouched at save, new outline created without changing template');
  } finally {
    await browser.close();
    server.kill('SIGTERM');
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
