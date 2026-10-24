import test from 'node:test';
import assert from 'node:assert/strict';
import { formatTimestamp, insertTimestamp, timestampFormats } from '../../js/timestamp.js';

const date = new Date('2026-10-24T14:05:00Z');
test('all five timestamp choices use the requested locale and timezone', () => {
  const settings = { date, locale: 'en-GB', timeZone: 'UTC' };
  assert.equal(formatTimestamp('date-short', settings), '24/10/2026');
  assert.equal(formatTimestamp('date-long', settings), '24 October 2026');
  assert.equal(formatTimestamp('time', settings), '14:05');
  for (const kind of ['date-time-short', 'date-time-long']) {
    const text = formatTimestamp(kind, settings);
    assert.match(text, /14:05/);
    assert.match(text, kind.endsWith('long') ? /24 October 2026/ : /24\/10\/2026/);
  }
  assert.equal(timestampFormats.length, 5);
  assert.throws(() => formatTimestamp('unknown', settings), RangeError);
});

test('insertion replaces the caret range immutably and preserves nested extension data', () => {
  const doc = { title: 'Plan', columns: { custom: true }, rows: [{ id: 'a', text: 'Parent', children: [{ id: 'b', text: 'Hello world', custom: { color: 'red' }, children: [] }] }] };
  const result = insertTimestamp(doc, { id: 'b', offset: 6, end: 11, direction: 'backward' }, '24/10/2026');
  assert.equal(result.document.rows[0].children[0].text, 'Hello 24/10/2026');
  assert.equal(doc.rows[0].children[0].text, 'Hello world');
  assert.deepEqual(result.document.columns, doc.columns);
  assert.deepEqual(result.document.rows[0].children[0].custom, { color: 'red' });
  assert.deepEqual(result.focus, { id: 'b', offset: 16, end: 16, direction: 'none' });
});

test('note selection inserts into the note without changing topic text', () => {
  const doc = { rows: [{ id: 'a', text: 'Topic', note: 'A note', noteVisible: true, children: [] }] };
  const result = insertTimestamp(doc, { id: 'a', field: 'note', offset: 2, end: 6 }, '14:05');
  assert.equal(result.document.rows[0].note, 'A 14:05');
  assert.equal(result.document.rows[0].text, 'Topic');
  assert.equal(result.focus.field, 'note');
});

test('missing target is unchanged and stale offsets are clamped safely', () => {
  const doc = { rows: [{ id: 'a', text: 'A', children: [] }] };
  assert.equal(insertTimestamp(doc, null, 'date').document, doc);
  assert.equal(insertTimestamp(doc, { id: 'missing' }, 'date').document, doc);
  assert.equal(insertTimestamp(doc, { id: 'a', offset: 99, end: 100 }, '!').document.rows[0].text, 'A!');
});
