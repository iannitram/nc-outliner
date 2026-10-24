import { test } from 'node:test';
import assert from 'node:assert/strict';
import { serializeOpml, parseOpml } from '../../js/opml.js';

const row = (id, text, children = [], more = {}) =>
  ({ id, text, note: '', noteOpen: false, collapsed: false, children, ...more });

const HEAD = (title) => `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0" xmlns:ol="urn:nc-outliner:ns:1">\n  <head>\n    <title>${title}</title>\n  </head>\n`;

test('serialize empty doc', () => {
  const result = serializeOpml({title:'Empty', rows:[]});
  const expected = HEAD('Empty') + '  <body/>\n</opml>\n';
  assert.strictEqual(result, expected);
});

test('serialize simple nested doc', () => {
  const result = serializeOpml({title:'Plan', rows:[row('r1','Alpha',[row('r2','Beta')])]});  
  const expected = HEAD('Plan') + '  <body>\n    <outline text="Alpha" ol:id="r1">\n      <outline text="Beta" ol:id="r2"/>\n    </outline>\n  </body>\n</opml>\n';
  assert.strictEqual(result, expected);
});

test('serialize with escaping and attributes', () => {
  const r = row('r1','A & B <c> "d"', [], {note:'line1\nline2', collapsed:true, noteOpen:true});
  const result = serializeOpml({title:'T', rows: [r]});
  const expectedLine = '    <outline text="A &amp; B &lt;c&gt; &quot;d&quot;" _note="line1&#10;line2" ol:id="r1" ol:collapsed="true" ol:noteOpen="true"/>';
  assert.ok(result.includes(expectedLine));
});

test('serialize with extra attributes', () => {
  const r = row('r1','X',[],{extra:{_status:'checked'}});
  const result = serializeOpml({title:'T', rows: [r]});
  const expectedLine = '    <outline text="X" ol:id="r1" _status="checked"/>';
  assert.ok(result.includes(expectedLine));
});

test('serialize title escaping', () => {
  const result = serializeOpml({title:'A & B < C', rows:[]});
  assert.ok(result.includes('<title>A &amp; B &lt; C</title>'));
});

test('round trip test', () => {
  const doc = {title:'Round', rows:[row('r1','A & B <c> "d"',[row('r2','kid',[],{extra:{_status:'checked'}})],{note:'l1\nl2', collapsed:true, noteOpen:true}), row('r3','')]};
  const parsed = parseOpml(serializeOpml(doc), () => 'zz');
  assert.deepStrictEqual(parsed, doc);
});

test('parse Omni-style input', () => {
  const xml = `<?xml version="1.0"?>\n<!-- exported -->\n<opml version="2.0"><head><title>T &amp; U</title></head><body>\n<outline text=\'One &#233; &#x26;\' _note=\'n\'><outline text="Two"/></outline>\n<outline text="Three"/>\n</body></opml>`;
  const result = parseOpml(xml, () => 'n1');
  const expected = {title:'T & U', rows:[row('n1','One é &',[row('n2','Two')],{note:'n'}), row('n3','Three')]};
  console.log('DEBUG: Result from test:', JSON.stringify(result));
  console.log('DEBUG: Expected from test:', JSON.stringify(expected));
  assert.deepStrictEqual(result, expected);
});

test('parse errors', () => {
  assert.throws(() => parseOpml('<opml><body><outline text="a"></body></opml>', () => 'x'), /Invalid OPML/);
  assert.throws(() => parseOpml('<html/>', () => 'x'), /Invalid OPML/);
  assert.throws(() => parseOpml('<opml><head/></opml>', () => 'x'), /Invalid OPML/);
});
