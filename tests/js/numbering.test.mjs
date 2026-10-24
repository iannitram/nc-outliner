import test from 'node:test';
import assert from 'node:assert/strict';
import { rowNumbers, setNumbering } from '../../js/numbering.js';
import { mountEditor } from '../../js/editor.js';
import { moveRow } from '../../js/row-actions.js';

const fixture = () => ({ title: 'Plan', rows: [
  { id: 'a', text: 'Parent', collapsed: true, children: [{ id: 'b', text: 'Child', children: [{ id: 'c', text: 'Deep', children: [] }] }] },
  { id: 'd', text: 'Other', children: [] },
] });

test('all styles and suffixes label the full tree and restart siblings', () => {
  const doc = fixture();
  assert.equal(rowNumbers(doc).size, 0);
  for (const [style, labels] of [['decimal', ['1', '1', '1', '2']], ['alpha', ['a', 'a', 'a', 'b']], ['roman', ['i', 'i', 'i', 'ii']], ['section', ['1', '1.1', '1.1.1', '2']]]) {
    for (const suffix of ['.', ')', ':', '']) {
      const next = setNumbering(doc, { style, suffix });
      assert.deepEqual([...rowNumbers(next).values()], labels.map((label) => label + suffix));
      assert.equal(next.rows, doc.rows);
      assert.equal(setNumbering(next, { style, suffix }), next);
    }
  }
  assert.equal(doc.numbering, undefined);
  assert.throws(() => setNumbering(doc, { style: 'bad', suffix: '.' }));
  assert.throws(() => setNumbering(doc, { style: 'alpha', suffix: '<' }));
});

test('letters roll over z and Roman numerals use subtractive notation', () => {
  const doc = { rows: Array.from({ length: 100 }, (_, i) => ({ id: String(i), children: [] })) };
  const alpha = rowNumbers(setNumbering(doc, { style: 'alpha', suffix: ')' }));
  assert.equal(alpha.get('25'), 'z)'); assert.equal(alpha.get('26'), 'aa)'); assert.equal(alpha.get('51'), 'az)'); assert.equal(alpha.get('52'), 'ba)');
  const roman = rowNumbers(setNumbering(doc, { style: 'roman', suffix: '.' }));
  assert.equal(roman.get('3'), 'iv.'); assert.equal(roman.get('8'), 'ix.'); assert.equal(roman.get('48'), 'xlix.'); assert.equal(roman.get('98'), 'xcix.');
});

class Element {
  constructor(tag, ownerDocument) { Object.assign(this, { tag, ownerDocument, children: [], dataset: {}, attributes: {}, listeners: {}, value: '', selectionStart: 0, selectionEnd: 0, classList: { add() {} } }); }
  appendChild(child) { this.children.push(child); child.parent = this; return child; }
  insertBefore(child, before) { this.children.splice(Math.max(0, this.children.indexOf(before)), 0, child); child.parent = this; }
  get firstChild() { return this.children[0]; }
  replaceChildren() { this.children = []; }
  setAttribute(k, v) { this.attributes[k] = v; }
  contains(target) { return target === this || this.children.some((child) => child.contains(target)); }
  matches() { return this.tag === 'textarea' && Boolean(this.dataset.rowId); }
  querySelectorAll() { return this.children.flatMap((child) => [...(child.matches() ? [child] : []), ...child.querySelectorAll()]); }
  addEventListener(type, fn) { this.listeners[type] = fn; }
  removeEventListener(type) { delete this.listeners[type]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange(start, end) { Object.assign(this, { selectionStart: start, selectionEnd: end }); }
  remove() { this.parent.children = this.parent.children.filter((child) => child !== this); }
}
const descendants = (node) => node.children.flatMap((child) => [child, ...descendants(child)]);


test('editor numbering controls persist, undo, redo, and renumber after structural edits', () => {
  const dom = { createElement(tag) { return new Element(tag, this); } };
  const host = new Element('div', dom);
  const changes = [];
  const editor = mountEditor(host, fixture(), (document) => changes.push(document));
  const controls = () => descendants(host);
  const style = () => controls().find((el) => el.attributes['aria-label'] === 'Row numbering');
  const suffix = () => controls().find((el) => el.attributes['aria-label'] === 'Number suffix');
  const labels = () => controls().filter((el) => el.className === 'outliner-number').map((el) => el.textContent);
  assert.equal(suffix().disabled, true);
  style().value = 'section'; style().listeners.change();
  assert.deepEqual(labels(), ['1.', '2.']);
  assert.deepEqual(changes[0].numbering, { style: 'section', suffix: '.' });
  suffix().value = ')'; suffix().listeners.change();
  assert.deepEqual(labels(), ['1)', '2)']);
  editor.undo(); assert.equal(suffix().value, '.');
  editor.redo(); assert.equal(suffix().value, ')');
  editor.change((doc) => moveRow(doc, 'd', -1));
  assert.equal(rowNumbers(editor.getDocument()).get('b'), '2.1)');
  const search = controls().find((el) => el.type === 'search');
  search.value = 'Other'; search.listeners.input();
  assert.deepEqual(labels(), ['1)']);
  editor.replaceDocument({ title: 'Separate', rows: fixture().rows });
  assert.equal(style().value, 'none'); assert.equal(labels().length, 0);
  assert.equal(editor.getDocument().rows[0].text, 'Parent');
});
