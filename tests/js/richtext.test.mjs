import test from 'node:test';
import assert from 'node:assert/strict';
import { toggleFormat, rebaseFormats, normalizeFormats, formatCommand } from '../../js/richtext.js';
import { updateText } from '../../js/model.js';
import { updateNote } from '../../js/notes.js';
import { insertTimestamp } from '../../js/timestamp.js';
import { createHistory } from '../../js/history.js';
import { createAutosave } from '../../js/autosave.js';
const range = (start, end, ...marks) => ({ start, end, marks });
const document = () => ({
  title: 'Test',
  rows: [{ id: 'a', text: 'A😀 test', note: 'my note', custom: 42, children: [] }],
});

test('all four marks toggle selected topic and note ranges independently', () => {
  for (const field of ['text', 'note'])
    for (const mark of ['bold', 'italic', 'underline', 'strikethrough']) {
      const doc = document(),
        selection = { id: 'a', offset: 1, end: 4, field };
      const next = toggleFormat(doc, selection, mark),
        key = field === 'text' ? 'textFormats' : 'noteFormats';
      assert.deepEqual(next.rows[0][key], [range(1, 4, mark)]);
      assert.deepEqual(toggleFormat(next, selection, mark).rows[0][key], []);
      assert.equal(next.rows[0].custom, 42);
      assert.equal(doc.rows[0][key], undefined);
    }
});
test('overlapping mixed marks split, normalize and remove only fully covered selection', () => {
  let doc = toggleFormat(document(), { id: 'a', offset: 0, end: 4 }, 'bold');
  doc = toggleFormat(doc, { id: 'a', offset: 2, end: 6 }, 'italic');
  assert.deepEqual(doc.rows[0].textFormats, [
    range(0, 2, 'bold'),
    range(2, 4, 'bold', 'italic'),
    range(4, 6, 'italic'),
  ]);
  doc = toggleFormat(doc, { id: 'a', offset: 1, end: 5 }, 'bold');
  assert.deepEqual(doc.rows[0].textFormats, [
    range(0, 2, 'bold'),
    range(2, 5, 'bold', 'italic'),
    range(5, 6, 'italic'),
  ]);
  doc = toggleFormat(doc, { id: 'a', offset: 0, end: 5 }, 'bold');
  assert.deepEqual(doc.rows[0].textFormats, [range(2, 6, 'italic')]);
});
test('empty selection and missing rows do not create history entries', () => {
  const doc = document();
  assert.equal(toggleFormat(doc, { id: 'a', offset: 2, end: 2 }, 'bold'), doc);
  assert.equal(toggleFormat(doc, { id: 'missing', offset: 0, end: 1 }, 'bold'), doc);
  assert.equal(toggleFormat(doc, { id: 'a', offset: 0, end: 1 }, 'script'), doc);
});
test('typing, replacement, deletion, notes and timestamp rebase annotations', () => {
  const ranges = [range(1, 5, 'bold')];
  assert.deepEqual(rebaseFormats(ranges, 'abcdef', 'abXXcdef', { offset: 2, end: 2 }), [range(1, 7, 'bold')]);
  assert.deepEqual(rebaseFormats(ranges, 'abcdef', 'abef', { offset: 2, end: 4 }), [range(1, 3, 'bold')]);
  assert.deepEqual(rebaseFormats(ranges, 'abcdef', 'x', { offset: 0, end: 6 }), []);
  let doc = document();
  doc.rows[0].textFormats = [range(1, 7, 'italic')];
  doc.rows[0].noteFormats = [range(0, 7, 'underline')];
  doc = updateText(doc, 'a', 'A😀 XXtest', { offset: 4, end: 4 });
  assert.deepEqual(doc.rows[0].textFormats, [range(1, 9, 'italic')]);
  doc = updateNote(doc, 'a', 'my', { offset: 2, end: 7 });
  assert.deepEqual(doc.rows[0].noteFormats, [range(0, 2, 'underline')]);
  doc = insertTimestamp(doc, { id: 'a', offset: 1, end: 2, field: 'note' }, 'DATE').document;
  assert.deepEqual(doc.rows[0].noteFormats, [range(0, 5, 'underline')]);
});
test('safe normalization ignores unknown marks and never interprets HTML', () => {
  assert.deepEqual(
    normalizeFormats([range(0, 4, 'bold', '<script>'), range(-1, 2, 'italic'), range(1, 100, 'underline')], 4),
    [range(0, 4, 'bold')],
  );
  assert.equal(formatCommand({ key: 'b', ctrlKey: true }), 'bold');
  assert.equal(formatCommand({ key: 'x', metaKey: true, shiftKey: true }), 'strikethrough');
  assert.equal(formatCommand({ key: 'b', ctrlKey: true, isComposing: true }), null);
});
test('formatting survives history snapshots and autosave transport', async () => {
  const doc = document(),
    selection = { id: 'a', offset: 1, end: 4 };
  const next = toggleFormat(doc, selection, 'bold');
  const history = createHistory({ document: doc, selection });
  history.record({ document: next, selection }, selection);
  assert.equal(history.undo().document.rows[0].textFormats, undefined);
  assert.deepEqual(history.redo().document.rows[0].textFormats, [range(1, 4, 'bold')]);
  let saved;
  const autosave = createAutosave({
    save: async (snapshot) => {
      saved = snapshot;
      return { etag: 'new' };
    },
    etag: 'old',
  });
  autosave.update(next);
  await autosave.flush();
  assert.deepEqual(saved.rows[0].textFormats, [range(1, 4, 'bold')]);
  autosave.dispose();
});
