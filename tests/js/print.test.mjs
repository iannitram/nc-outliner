import test from 'node:test';
import assert from 'node:assert/strict';
import { collectPrintRows } from '../../js/print.js';

const outline = {
  title: 'Planning',
  rows: [
    { id: 'a', text: 'Project', note: 'context', collapsed: true, checked: true, children: [
      { id: 'b', text: 'Done', note: 'shipped', checked: true, children: [] },
      { id: 'c', text: 'Next', note: 'pending', checked: false, children: [] },
    ] },
  ],
};

test('print snapshot expands collapsed descendants and includes notes without mutating source', () => {
  const before = structuredClone(outline);
  assert.deepEqual(collectPrintRows(outline, { expandAll: true, includeNotes: true }), [
    { id: 'a', text: 'Project', note: 'context', depth: 0 },
    { id: 'b', text: 'Done', note: 'shipped', depth: 1 },
    { id: 'c', text: 'Next', note: 'pending', depth: 1 },
  ]);
  assert.deepEqual(outline, before);
});

test('print snapshot can preserve collapsed state, omit notes and filter checkbox state', () => {
  assert.deepEqual(collectPrintRows(outline, { expandAll: false, includeNotes: false, checkedRows: 'checked' }), [
    { id: 'a', text: 'Project', note: '', depth: 0 },
  ]);
  assert.deepEqual(collectPrintRows(outline, { expandAll: true, checkedRows: 'unchecked' }).map(row => row.id), ['c']);
});

test('selected-only snapshot includes only explicitly selected rows in document order', () => {
  const rows = collectPrintRows(outline, { expandAll: true, selectedOnly: true }, ['c', 'a']);
  assert.deepEqual(rows.map(row => row.id), ['a', 'c']);
  assert.deepEqual(rows.map(row => row.depth), [0, 1]);
});
