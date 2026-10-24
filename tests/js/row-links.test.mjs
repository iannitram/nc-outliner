import test from 'node:test';
import assert from 'node:assert/strict';
import { createRowLinkUrl, readRowLink } from '../../js/row-links.js';
import { start } from '../../js/app.js';

test('row link URLs safely encode nested outline names and stable row IDs', () => {
  const href = createRowLinkUrl('Plan & Notes.opml', 'row /?é', 'https://cloud.example/apps/outliner/');
  const url = new URL(href);
  assert.equal(url.origin, 'https://cloud.example');
  assert.equal(url.pathname, '/apps/outliner/');
  assert.deepEqual(readRowLink(href), { outline: 'Plan & Notes.opml', row: 'row /?é' });
  const nested = createRowLinkUrl('Work/Plan.opml', 'row-1', 'https://cloud.example/apps/outliner/');
  assert.equal(new URL(nested).searchParams.get('outline'), 'Work/Plan.opml');
  assert.match(nested, /outline=Work%2FPlan\.opml/);
  assert.deepEqual(readRowLink(nested), { outline: 'Work/Plan.opml', row: 'row-1' });
  assert.throws(() => createRowLinkUrl('../secret.opml', 'row'), /valid outline and row/);
  assert.throws(() => createRowLinkUrl('Work//Plan.opml', 'row'), /valid outline and row/);
  assert.throws(() => createRowLinkUrl('Plan.opml', ''), /valid outline and row/);
});

test('malformed, missing, duplicate and unsafe URL targets are marked invalid', () => {
  for (const href of [
    'https://cloud.example/app?outline=Plan.opml',
    'https://cloud.example/app?row=x',
    'https://cloud.example/app?outline=Plan.opml&row=',
    'https://cloud.example/app?outline=Plan.opml&outline=Other.opml&row=x',
    'https://cloud.example/app?outline=%2Fetc%2Fpasswd.opml&row=x',
  ]) assert.deepEqual(readRowLink(href), { invalid: true });
  assert.equal(readRowLink('https://cloud.example/app'), null);
  assert.deepEqual(readRowLink('http://[invalid'), { invalid: true });
});

class Element {
  constructor(tag, ownerDocument) {
    Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, selectionDirection: 'none', classList: { add() {} } });
  }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  append(...children) { children.forEach(child => this.appendChild(child)); }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  get firstChild() { return this.children[0]; }
  replaceChildren(...children) { this.children.forEach(child => { child.parent = null; }); this.children = []; this.append(...children); }
  setAttribute(k, v) { this.attributes[k] = v; }
  contains(target) { return target === this || this.children.some(child => child.contains(target)); }
  matches(selector = '') {
    if (this.tag !== 'textarea') return false;
    if (selector.includes('note-id')) return Boolean(this.dataset.noteId);
    if (selector.includes('row-id')) return Boolean(this.dataset.rowId);
    return Boolean(this.dataset.rowId || this.dataset.noteId);
  }
  querySelectorAll(selector = '') { return this.children.flatMap(child => [...(child.matches(selector) ? [child] : []), ...child.querySelectorAll(selector)]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end, direction = 'none') { Object.assign(this, { selectionStart: start, selectionEnd: end, selectionDirection: direction }); }
  scrollIntoView(options) { this.scrollOptions = options; }
  remove() { if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
}

function appDocument() {
  return {
    createElement(tag) { return new Element(tag, this); },
    addEventListener() {},
    visibilityState: 'visible',
  };
}

function allElements(root) {
  return root.children.flatMap(child => [child, ...allElements(child)]);
}

async function mountedApp({ href, clipboard, openError, outlineName = 'Plan & Notes.opml' } = {}) {
  const document = appDocument();
  const element = new Element('main', document);
  element.dataset.apiBase = '/apps/outliner/api';
  const calls = [];
  const api = async (path = '', method = 'GET', data) => {
    calls.push({ path, method, data });
    if (path === '') return [outlineName];
    if (openError) throw new Error(openError);
    return {
      name: outlineName, etag: 'etag-1',
      document: { title: 'Plan', rows: [{ id: 'parent', text: 'Parent', collapsed: true, children: [{ id: 'row /?é', text: 'Target', children: [] }] }] },
    };
  };
  const priorAddEventListener = globalThis.addEventListener;
  globalThis.addEventListener = () => {};
  try {
    await start(element, { api, href, clipboard, mountTheme() {} });
  } finally {
    if (priorAddEventListener) globalThis.addEventListener = priorAddEventListener;
    else delete globalThis.addEventListener;
  }
  return { element, document, calls };
}

test('browser app opens an authorized outline from a row URL, expands ancestors, focuses and scrolls without writing', async () => {
  const copied = [];
  const href = 'https://cloud.example/apps/outliner/?outline=Plan+%26+Notes.opml&row=row+%2F%3F%C3%A9';
  const f = await mountedApp({ href, clipboard: { async writeText(value) { copied.push(value); } } });
  assert.deepEqual(f.calls.map(call => [call.method, call.path]), [['GET', ''], ['GET', '/Plan%20%26%20Notes.opml']]);
  const inputs = f.element.querySelectorAll('textarea[data-row-id]');
  assert.deepEqual(inputs.map(input => input.dataset.rowId), ['parent', 'row /?é']);
  assert.equal(f.document.activeElement.dataset.rowId, 'row /?é');
  assert.deepEqual(f.document.activeElement.scrollOptions, { block: 'center' });
  const buttons = allElements(f.element).filter(node => node.tag === 'button');
  const copyButton = buttons.find(button => button.textContent === 'Copy link' && button.attributes['aria-label'].includes('Target'));
  await copyButton.listeners.click();
  assert.equal(new URL(copied[0]).searchParams.get('outline'), 'Plan & Notes.opml');
  assert.equal(new URL(copied[0]).searchParams.get('row'), 'row /?é');
  const parentDisclosure = allElements(f.element).find(node => node.tag === 'button' && node.attributes['aria-label'] === 'Collapse row');
  assert.equal(parentDisclosure.attributes['aria-expanded'], 'true');
  parentDisclosure.listeners.click();
  assert.deepEqual(f.element.querySelectorAll('textarea[data-row-id]').map(input => input.dataset.rowId), ['parent']);
  assert.equal(f.document.activeElement.dataset.rowId, 'parent');
  assert.equal(f.calls.some(call => call.method === 'PUT'), false);
});

test('browser app reopens a nested outline name through the normal encoded API path', async () => {
  const f = await mountedApp({
    href: 'https://cloud.example/apps/outliner/?outline=Work%2FPlan.opml&row=row+%2F%3F%C3%A9',
    outlineName: 'Work/Plan.opml',
  });
  assert.deepEqual(f.calls.map(call => [call.method, call.path]), [
    ['GET', ''], ['GET', '/Work%2FPlan.opml'],
  ]);
  assert.equal(f.document.activeElement.dataset.rowId, 'row /?é');
});

test('browser app surfaces missing row, rejected clipboard, invalid URL, and unauthorized file errors', async () => {
  const missing = await mountedApp({ href: 'https://cloud.example/app?outline=Plan.opml&row=missing', clipboard: { writeText() { throw new Error('blocked'); } } });
  const status = () => allElements(missing.element).find(node => node.attributes?.['aria-live'] === 'polite' && node.attributes?.['aria-atomic'] === 'true');
  assert.equal(status().textContent, 'The linked row was not found in this outline.');
  const copyButton = allElements(missing.element).find(node => node.tag === 'button' && node.textContent === 'Copy link');
  await copyButton.listeners.click();
  assert.match(status().textContent, /Could not copy/);

  const invalid = await mountedApp({ href: 'https://cloud.example/app?outline=Plan.opml' });
  const invalidStatus = allElements(invalid.element).find(node => node.attributes?.['aria-live'] === 'polite' && node.attributes?.['aria-atomic'] === 'true');
  assert.equal(invalidStatus.textContent, 'This row link is invalid.');
  assert.deepEqual(invalid.calls.map(call => call.path), ['']);

  const denied = await mountedApp({ href: 'https://cloud.example/app?outline=Plan.opml&row=x', openError: 'Access denied' });
  const deniedStatus = allElements(denied.element).find(node => node.attributes?.['aria-live'] === 'polite' && node.attributes?.['aria-atomic'] === 'true');
  assert.equal(deniedStatus.textContent, 'Access denied');
  assert.ok(denied.calls.some(call => call.path === '/Plan.opml'));
});
