import { strict as assert } from 'node:assert';
import test from 'node:test';
import { createHistory, historyCommand } from '../../js/history.js';

const snap = (text, offset = text.length) => ({
  document: { title: 'Outline', rows: [{ id: 'a', text, children: [], styles: { font: 'serif' } }], columns: ['future'] },
  selection: { id: 'a', offset },
});

test('undo and redo restore document metadata and caret', () => {
  const history = createHistory(snap('hello'));
  history.record(snap('world'), { id: 'a', offset: 2 });
  assert.deepEqual(history.undo(), snap('hello', 2));
  assert.deepEqual(history.redo(), snap('world'));
  assert.equal(history.redo(), null);
});

test('snapshots cannot be mutated by callers', () => {
  const initial = snap('a');
  const history = createHistory(initial);
  initial.document.rows[0].styles.font = 'changed';
  const next = snap('b');
  history.record(next);
  next.document.rows[0].text = 'changed';
  const previous = history.undo();
  previous.document.columns.push('changed');
  assert.deepEqual(history.getSnapshot(), snap('a'));
  assert.deepEqual(history.redo(), snap('b'));
});

test('selection-only changes keep redo and do not add undo entries', () => {
  const history = createHistory(snap('a'));
  assert.equal(history.record(snap('a', 0)), false);
  assert.equal(history.undo(), null);
  history.record(snap('b'));
  history.undo();
  assert.equal(history.record(snap('a', 0)), false);
  assert.equal(history.getState().canRedo, true);
  assert.deepEqual(history.redo(), snap('b'));
});

test('a new edit after undo discards redo', () => {
  const history = createHistory(snap('a'));
  history.record(snap('b'));
  history.undo();
  history.record(snap('c'));
  assert.equal(history.redo(), null);
  assert.deepEqual(history.undo(), snap('a'));
});

test('reset on outline switch clears both stacks and notifies controls', () => {
  const history = createHistory(snap('a'));
  const states = [];
  const unsubscribe = history.subscribe((state) => states.push(state));
  history.record(snap('b'));
  history.undo();
  history.reset(snap('another'));
  assert.deepEqual(states, [
    { canUndo: false, canRedo: false }, { canUndo: true, canRedo: false },
    { canUndo: false, canRedo: true }, { canUndo: false, canRedo: false },
  ]);
  assert.equal(history.undo(), null);
  assert.equal(history.redo(), null);
  unsubscribe();
});

test('history bound retains only latest undo entries', () => {
  const history = createHistory(snap('a'), { limit: 2 });
  for (const text of ['b', 'c', 'd']) history.record(snap(text));
  assert.deepEqual(history.undo(), snap('c'));
  assert.deepEqual(history.undo(), snap('b'));
  assert.equal(history.undo(), null);
  assert.throws(() => createHistory(snap('a'), { limit: 0 }), RangeError);
});

test('nested structural changes are undoable as a single command', () => {
  const before = snap('parent');
  const after = structuredClone(before);
  after.document.rows[0].children = [{ id: 'b', text: 'child', children: [], custom: 'retained' }];
  after.document.rows[0].collapsed = true;
  const history = createHistory(before);
  history.record(after);
  assert.deepEqual(history.undo(), before);
  assert.deepEqual(history.redo(), after);
});

test('platform shortcuts recognize undo and redo without intercepting IME', () => {
  assert.equal(historyCommand({ key: 'z', ctrlKey: true }), 'undo');
  assert.equal(historyCommand({ key: 'Z', metaKey: true, shiftKey: true }), 'redo');
  assert.equal(historyCommand({ key: 'y', ctrlKey: true }), 'redo');
  for (const event of [
    { key: 'z' }, { key: 'z', ctrlKey: true, altKey: true },
    { key: 'z', metaKey: true, isComposing: true }, { key: 'y', metaKey: true },
  ]) assert.equal(historyCommand(event), null);
});
