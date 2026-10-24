import test from 'node:test';
import assert from 'node:assert/strict';
import { exportText, exportFilename, prepareExport, mountExport, downloadExport } from '../../js/export.js';

const doc = { title: 'Plan', rows: [{ id: 'a', text: 'Parent *bold*\nnext', note: 'hidden <note>\nline', noteVisible: false, collapsed: true, children: [{ id: 'b', text: 'Child [x]', children: [] }] }] };
test('text export traverses collapsed descendants and hidden notes without changing document', () => {
  const before = structuredClone(doc);
  assert.equal(exportText(doc), 'Parent *bold*\n\tnext\n\thidden <note>\n\tline\n\tChild [x]\n');
  assert.deepEqual(doc, before);
  assert.equal(exportText({ rows: [] }), '');
});
test('Markdown export escapes literal formatting, keeps multiline items and indented note quotes', () => {
  assert.equal(exportText(doc, true), '- Parent \\*bold\\*\n  next\n  > hidden \\<note\\>\n  > line\n  - Child \\[x\\]\n');
});
test('export filename strips paths/control characters and has matching extension', () => {
  assert.equal(exportFilename('../a/b\\c.opml', 'text'), '_a_b_c.txt');
  assert.equal(exportFilename('Plan.OPML', 'markdown'), 'Plan.md');
  assert.equal(exportFilename('...', 'opml'), 'Outline.opml');
  assert.throws(() => exportFilename('Plan', 'html'), /Unknown/);
});
test('OPML export posts a snapshot of unsaved document and preserves server XML verbatim', async () => {
  const current = { name: 'My plan.opml', document: structuredClone(doc) };
  const xml = '<opml xmlns:x="urn:custom"><head><x:columns/></head><body/></opml>';
  let sent;
  const result = await prepareExport(current, 'opml', async (path, method, data) => {
    sent = { path, method, data };
    current.document.rows[0].text = 'later edit';
    return { content: xml };
  });
  assert.equal(sent.path, '/My%20plan.opml/export');
  assert.equal(sent.method, 'POST');
  assert.equal(sent.data.document.rows[0].text, doc.rows[0].text);
  assert.deepEqual(result, { filename: 'My plan.opml', type: 'text/x-opml;charset=utf-8', content: xml });
});
test('text and Markdown export current unsaved edits without a network write', async () => {
  const api = () => { throw new Error('No API call expected'); };
  const current = { name: 'Plan.opml', document: doc };
  assert.equal((await prepareExport(current, 'text', api)).content, exportText(doc));
  assert.equal((await prepareExport(current, 'markdown', api)).filename, 'Plan.md');
  await assert.rejects(prepareExport(null, 'text', api), /Open an outline/);
  await assert.rejects(prepareExport(current, 'html', api), /Unknown/);
  await assert.rejects(prepareExport(current, 'opml', async () => ({})), /invalid/);
});
class Element {
  constructor(tag, dom) { Object.assign(this, { tag, ownerDocument: dom, children: [], listeners: {}, value: '' }); }
  append(...children) { this.children.push(...children); if (this.tag === 'select' && !this.value) this.value = children[0].value; }
  setAttribute() {}
  addEventListener(type, fn) { this.listeners[type] = fn; }
  remove() { this.removed = true; }
}
test('reachable export controls enable for current outline and report failed OPML instead of downloading', async () => {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const container = new Element('div', dom);
  let current = null; const downloads = []; const errors = [];
  const controls = mountExport(container, () => current, async () => { throw new Error('offline'); }, error => errors.push(error.message), result => downloads.push(result));
  const [select, button] = container.children[0].children;
  assert.equal(button.disabled, true);
  current = { name: 'Plan.opml', document: doc }; controls.refresh();
  assert.equal(button.disabled, false);
  await button.listeners.click();
  assert.equal(downloads[0].content, exportText(doc));
  select.value = 'opml'; await button.listeners.click();
  assert.deepEqual(errors, ['offline']); assert.equal(downloads.length, 1); assert.equal(button.disabled, false);
  controls.destroy(); assert.equal(container.children[0].removed, true);
});
test('download uses a Blob URL, safe download filename and cleans up link/URL', async () => {
  let link; let blob; let revoked;
  const dom = { createElement() { return link = { click() { this.clicked = true; }, remove() { this.removed = true; } }; }, body: { append() {} } };
  downloadExport({ content: '<literal>', filename: 'Plan.txt', type: 'text/plain' }, dom, { createObjectURL(value) { blob = value; return 'blob:test'; }, revokeObjectURL(url) { revoked = url; } });
  assert.equal(await blob.text(), '<literal>'); assert.equal(link.download, 'Plan.txt'); assert.equal(link.clicked, true); assert.equal(link.removed, true);
  await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(revoked, 'blob:test');
});
