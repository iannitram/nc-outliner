import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRow, findRow, insertRowAfter, setRowText, deleteRow, flattenVisible, neighborId, newRowId } from '../../js/model.js';

const R = (id, children = []) => ({ ...createRow(id), children });
const fx = () => [R('a', [R('b', [R('c')]), R('d')]), R('e')];
const flat = (rows) => flattenVisible(rows).map((x) => x.id + x.depth).join(',');

test('createRow creates rows with correct structure', () => {
	assert.deepStrictEqual(createRow('x'), { id: 'x', text: '', note: '', noteOpen: false, collapsed: false, children: [] });
	assert.strictEqual(createRow('y', 'hi').text, 'hi');
});

test('flattenVisible produces correct order', () => {
	assert.strictEqual(flat(fx()), 'a0,b1,c2,d1,e0');
	
	// Test with b collapsed
	const rows = fx();
	rows[0].children[0].collapsed = true;
	assert.strictEqual(flat(rows), 'a0,b1,d1,e0');
});

test('findRow finds rows correctly', () => {
	const result = findRow(fx(), 'c');
	assert.strictEqual(result.row.id, 'c');
	assert.strictEqual(result.parent.id, 'b');
	assert.strictEqual(result.index, 0);
	
	const result2 = findRow(fx(), 'e');
	assert.strictEqual(result2.parent, null);
	assert.strictEqual(result2.index, 1);
	
	assert.strictEqual(findRow(fx(), 'zz'), null);
});

test('insertRowAfter inserts rows correctly', () => {
	const rows = fx();
	const out = insertRowAfter(rows, 'b', R('f'));
	assert.strictEqual(flat(out), 'a0,b1,c2,f1,d1,e0');
	
	const out2 = insertRowAfter(rows, 'e', R('f'));
	assert.strictEqual(flat(out2), 'a0,b1,c2,d1,e0,f0');
	
	// Test with unknown id
	const out3 = insertRowAfter(rows, 'unknown', R('f'));
	assert.equal(out3, rows);
	
	// Verify original is unchanged
	assert.deepStrictEqual(rows, fx());
});

test('setRowText updates row text correctly', () => {
	const rows = fx();
	const out = setRowText(rows, 'c', 'X');
	assert.strictEqual(findRow(out, 'c').row.text, 'X');
	assert.strictEqual(findRow(rows, 'c').row.text, '');
	
	// Test with unknown id
	const out2 = setRowText(rows, 'unknown', 'X');
	assert.equal(out2, rows);
});

test('deleteRow removes rows correctly', () => {
	const rows = fx();
	const out = deleteRow(rows, 'b');
	assert.strictEqual(flat(out), 'a0,d1,e0');
	
	// Test with unknown id
	const out2 = deleteRow(rows, 'unknown');
	assert.equal(out2, rows);
});

test('neighborId finds neighbors correctly', () => {
	const rows = fx();
	assert.strictEqual(neighborId(rows, 'c', -1), 'b');
	assert.strictEqual(neighborId(rows, 'c', 1), 'd');
	assert.strictEqual(neighborId(rows, 'e', 1), null);
	assert.strictEqual(neighborId(rows, 'a', -1), null);
	
	// Test with b collapsed
	const rows2 = fx();
	rows2[0].children[0].collapsed = true;
	assert.strictEqual(neighborId(rows2, 'b', 1), 'd');
});

test('newRowId generates valid IDs', () => {
	const id1 = newRowId();
	const id2 = newRowId();
	assert.match(id1, /^r[a-z0-9]{8}$/);
	assert.match(id2, /^r[a-z0-9]{8}$/);
	assert.notStrictEqual(id1, id2);
});