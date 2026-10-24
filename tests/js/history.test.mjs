import { createHistory } from '../../js/history.js';
import { test } from 'node:test';
import assert from 'node:assert';

test('Basic undo/redo functionality', () => {
	let h = createHistory('A');
	h.push('B');
	h.push('C');
	assert.strictEqual(h.undo(), 'B');
	assert.strictEqual(h.undo(), 'A');
	assert.strictEqual(h.canUndo(), false);
	assert.strictEqual(h.undo(), null);
	assert.strictEqual(h.current(), 'A');
});

test('Redo functionality', () => {
	let h = createHistory('A');
	h.push('B');
	h.undo();
	assert.strictEqual(h.canRedo(), true);
	assert.strictEqual(h.redo(), 'B');
	
	// Test that redo clears future stack
	h.undo();
	h.push('X');
	assert.strictEqual(h.canRedo(), false);
	assert.strictEqual(h.redo(), null);
});

test('Coalescing functionality', () => {
	let t = 0;
	let h = createHistory('A', { now: () => t });
	
	// First push at time 0
	h.push('B', 'k');
	t = 500; // Advance time by 500ms
	
	// Second push within coalesce window with same key - should coalesce
	h.push('C', 'k');
	
	assert.strictEqual(h.current(), 'C');
	assert.strictEqual(h.undo(), 'A'); // Should only have one undo step
});

test('Coalescing window passed', () => {
	let t = 0;
	let h = createHistory('A', { now: () => t });
	
	// First push at time 0
	h.push('B', 'k');
	t = 1500; // Advance time by 1500ms (outside coalesce window)
	
	// Second push outside coalesce window - should not coalesce
	h.push('C', 'k');
	
	assert.strictEqual(h.undo(), 'B'); // Should be able to undo back to B, not A
});

test('Different keys do not coalesce', () => {
	let t = 0;
	let h = createHistory('A', { now: () => t });
	
	h.push('B', 'k1');
	t = 500; // Advance time by 500ms
	
	// Same time but different key - should not coalesce
	h.push('C', 'k2');
	
	assert.strictEqual(h.undo(), 'B'); // Should be able to undo back to B, not A
});

test('History limit functionality', () => {
	let h = createHistory(0, { limit: 3 });
	h.push(1);
	h.push(2);
	h.push(3);
	h.push(4);
	h.push(5); // This should cause oldest item (0) to be dropped
	
	// Undo until we can't undo anymore
	assert.strictEqual(h.undo(), 4);
	assert.strictEqual(h.undo(), 3);
	assert.strictEqual(h.undo(), 2);
	assert.strictEqual(h.undo(), null); // No more undos
	assert.strictEqual(h.current(), 2);
});

test('No change handling', () => {
	let h = createHistory('A');
	h.push('A'); // Same value, should not affect history
	
	assert.strictEqual(h.canUndo(), false);
});