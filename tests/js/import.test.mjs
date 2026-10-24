import test from 'node:test';
import assert from 'node:assert/strict';
import { parseOutlineText, importFilename, importOutline } from '../../js/import.js';

const texts = rows => rows.map(row => [row.text, texts(row.children)]);
test('tab-indented plain text and mixed Markdown bullets produce nested trees', () => {
  const doc = parseOutlineText('Root\n\tChild\n\t\tGrandchild\nSecond\n  - Bullet\n    1. Ordered\n  + Sibling\n', 'Plan');
  assert.equal(doc.title, 'Plan');
  assert.deepEqual(texts(doc.rows), [
    ['Root', [['Child', [['Grandchild', []]]]]],
    ['Second', [['Bullet', [['Ordered', []]]], ['Sibling', []]]],
  ]);
  const ids = [];
  function visit(rows) { for (const row of rows) { ids.push(row.id); visit(row.children); } }
  visit(doc.rows);
  assert.equal(new Set(ids).size, ids.length);
  assert.ok(ids.every(Boolean));
});
test('parser accepts CRLF, BOM, root indentation and treats HTML and headings as literal text', () => {
  const doc = parseOutlineText('\uFEFF  - <b>safe</b>\r\n    * nested\r\n\r\n# Heading\rPlain\r');
  assert.deepEqual(texts(doc.rows), [['<b>safe</b>', [['nested', []]]], ['# Heading', []], ['Plain', []]]);
});
test('parser rejects empty, oversized, deeply nested and control-character input', () => {
  assert.throws(() => parseOutlineText(' \n\t\n'), /some outline text/);
  assert.throws(() => parseOutlineText('x'.repeat(1024 * 1024 + 1)), /1 MB/);
  assert.throws(() => parseOutlineText(Array.from({ length: 102 }, (_, n) => ' '.repeat(n) + 'x').join('\n')), /deeply nested/);
  assert.throws(() => parseOutlineText('bad\0text'), /control characters/);
});
test('import name validation disallows paths and adds the OPML suffix once', () => {
  assert.equal(importFilename(' Plan '), 'Plan.opml');
  assert.equal(importFilename('Plan.OPML'), 'Plan.OPML');
  for (const name of ['', '../Plan', '/Plan', 'x\\y', '.hidden', 'x'.repeat(241)]) assert.throws(() => importFilename(name));
});
test('cancelled unsaved-change confirmation creates and saves nothing', async () => {
  let requests = 0;
  assert.equal(await importOutline(async () => { requests++; }, { name: 'Plan', text: 'Root' }, async () => false), null);
  assert.equal(requests, 0);
});
test('import validates before creating, saves only new filename with returned etag, and returns imported document', async () => {
  const calls = [];
  const api = async (...args) => {
    calls.push(args);
    return args[1] === 'POST' ? { name: 'New plan.opml', etag: 'created-tag', document: { title: 'New plan', rows: [] } } : { name: 'New plan.opml', etag: 'saved-tag' };
  };
  const result = await importOutline(api, { name: 'New plan', text: '- Root\n  - Child' });
  assert.deepEqual(calls[0], ['', 'POST', { name: 'New plan.opml' }]);
  assert.equal(calls[1][0], '/New%20plan.opml');
  assert.equal(calls[1][1], 'PUT');
  assert.equal(calls[1][2].etag, 'created-tag');
  assert.equal(result.etag, 'saved-tag');
  assert.deepEqual(texts(result.document.rows), [['Root', [['Child', []]]]]);
  await assert.rejects(importOutline(api, { name: 'Invalid', text: ' ' }), /some outline text/);
  assert.equal(calls.length, 2);
});
test('duplicate create never proceeds to save and failed saves preserve source text', async () => {
  let calls = 0;
  await assert.rejects(importOutline(async () => { calls++; throw new Error('Already exists'); }, { name: 'Old', text: 'replacement' }), /Already exists/);
  assert.equal(calls, 1);
  await assert.rejects(importOutline(async (_, method) => {
    if (method === 'POST') return { name: 'New.opml', etag: 'etag' };
    throw new Error('connection lost');
  }, { name: 'New', text: 'source' }), /source text is still in the import form/);
});
