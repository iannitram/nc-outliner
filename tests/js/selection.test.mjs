import test from 'node:test';
import assert from 'node:assert/strict';
import { createRowSelection, selectedRootIds, actOnRows } from '../../js/selection.js';
const row = (id, children = []) => ({ id, text: id, children, note: 'Keep', richText: `<b>${id}</b>`, custom: { id } });
const fixture = () => ({ metadata: { author: 'Owner' }, rows: [row('a'), row('b', [row('b1')]), row('c'), row('d')] });
test('Shift ranges extend, contract and reverse around a fixed anchor in displayed order', () => {
  const selection = createRowSelection(), visible = ['a','b','c','d'];
  selection.clear('b'); selection.select('d',{shift:true},visible);
  assert.deepEqual(selection.get().ids,['b','c','d']);
  selection.select('c',{shift:true},visible); assert.deepEqual(selection.get().ids,['b','c']);
  selection.select('a',{shift:true},visible); assert.deepEqual(selection.get().ids,['a','b']);
  assert.equal(selection.get().anchor,'b');
});
test('Ctrl/Cmd toggles disjoint rows and reconciles hidden or removed rows', () => {
  const s=createRowSelection(), visible=['a','b','c','d'];
  s.clear('a');s.select('c',{toggle:true},visible);assert.deepEqual(s.get().ids,['a','c']);
  s.select('a',{toggle:true},visible);assert.deepEqual(s.get().ids,['c']);
  s.select('d',{shift:true},['a','c','d']);assert.deepEqual(s.get().ids,['a','c','d']);
  s.reconcile(['a','d']);assert.deepEqual(s.get().ids,['a','d']);
  s.restore({id:'d',rowIds:['a','d'],rowAnchor:'a'});assert.deepEqual(s.get(),{ids:['a','d'],active:'d',anchor:'a'});
  s.clear();assert.deepEqual(s.get().ids,[]);
});
test('structural selection removes ancestor/descendant duplicates, deleting atomically and retaining metadata', () => {
  const original=fixture();
  assert.deepEqual(selectedRootIds(original,['b1','b','d']),['b','d']);
  const next=actOnRows(original,['b','b1','d'],'delete');
  assert.deepEqual(next.rows.map(r=>r.id),['a','c']);
  assert.deepEqual(next.metadata,original.metadata);assert.deepEqual(next.rows[1],original.rows[2]);
  assert.equal(original.rows[1].children[0].id,'b1');
  const empty=actOnRows(original,['a','b','c','d'],'delete');
  assert.equal(empty.rows.length,1);assert.equal(empty.rows[0].text,'');assert.ok(empty.rows[0].id);
});
test('bulk indent/outdent preserves sibling order, descendants, extension data and boundary groups', () => {
  const original=fixture();
  const nested=actOnRows(original,['b','b1','c'],'indent');
  assert.deepEqual(nested.rows[0].children.map(r=>r.id),['b','c']);
  assert.deepEqual(nested.rows[0].children[0],original.rows[1]);
  assert.deepEqual(actOnRows(nested,['b','c'],'outdent'),{...original,rows:[{...original.rows[0],collapsed:false},...original.rows.slice(1)]});
  assert.equal(actOnRows(original,['a','b'],'indent'),original);
  assert.equal(actOnRows(original,['a','b'],'outdent'),original);
});
test('bulk movement moves contiguous and disjoint groups once while honoring boundaries', () => {
  const original=fixture();
  const moved=actOnRows(original,['b','b1','c'],'up');
  assert.deepEqual(moved.rows.map(r=>r.id),['b','c','a','d']);
  assert.deepEqual(actOnRows(moved,['b','c'],'down'),original);
  assert.equal(actOnRows(original,['a','b'],'up'),original);
  assert.deepEqual(actOnRows(original,['b','d'],'up').rows.map(r=>r.id),['b','a','d','c']);
});
test('checking acts on explicit selection and reveals checkboxes without checking unselected descendants', () => {
  const original=fixture();const next=actOnRows(original,['b','d'],'check');
  assert.equal(next.showCheckboxes,true);assert.equal(next.rows[1].checked,true);assert.equal(next.rows[3].checked,true);
  assert.equal(next.rows[1].children[0].checked,undefined);
  assert.deepEqual(next.rows[1].custom,original.rows[1].custom);
  assert.equal(actOnRows(next,['b','d'],'check'),next);
  assert.equal(actOnRows(next,[],'delete'),next);
  assert.equal(actOnRows(next,['missing'],'delete'),next);
  assert.equal(actOnRows(next,['b'],'unknown'),next);
});
