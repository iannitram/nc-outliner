import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutosave, statusLabel } from '../../js/autosave.js';

const tick = () => new Promise((r) => setImmediate(r));

function fakeTimers() {
	let n = 0; const q = new Map();
	return {
		setTimeout(fn, ms) { n += 1; q.set(n, { fn, ms }); return n; },
		clearTimeout(id) { q.delete(id); },
		pending: () => [...q.values()].map((x) => x.ms),
		fire() { const [k, v] = [...q.entries()][0]; q.delete(k); v.fn(); },
	};
}

test('save resolves ok', async () => {
	const t = fakeTimers();
	const st = [];
	let saveCalls = 0;
	const save = () => {
		saveCalls += 1;
		return Promise.resolve({ ok: true });
	};

	const autosave = createAutosave({ save, onStatus: (s) => st.push(s), timers: t });
	autosave.change();
	assert.deepStrictEqual(st, ['saving']);
	assert.deepStrictEqual(t.pending(), [1500]);
	t.fire();
	await tick();
	assert.strictEqual(saveCalls, 1);
	assert.deepStrictEqual(st, ['saving', 'saved']);
});

test('three change calls in a row', async () => {
	const t = fakeTimers();
	const st = [];
	let saveCalls = 0;
	const save = () => {
		saveCalls += 1;
		return Promise.resolve({ ok: true });
	};

	const autosave = createAutosave({ save, onStatus: (s) => st.push(s), timers: t });
	autosave.change();
	autosave.change();
	autosave.change();
	assert.deepStrictEqual(t.pending(), [1500]);
	assert.deepStrictEqual(st, ['saving']);
});

test('change during a save', async () => {
	const t = fakeTimers();
	const st = [];
	let saveCalls = 0;
	const res = [];
	const save = () => {
		saveCalls += 1;
		return new Promise((r) => res.push(r));
	};

	const autosave = createAutosave({ save, onStatus: (s) => st.push(s), timers: t });
	autosave.change();
	t.fire();
	await tick();
	autosave.change();
	assert.deepStrictEqual(t.pending(), [1500]);
	res[0]({ ok: true });
	await tick();
	assert.deepStrictEqual(st, ['saving']);
	assert.deepStrictEqual(t.pending(), [1500]);
	t.fire();
	await tick();
	assert.strictEqual(saveCalls, 2);
	res[1]({ ok: true });
	await tick();
	assert.deepStrictEqual(st, ['saving', 'saved']);
});

test('failure then retry', async () => {
	const t = fakeTimers();
	const st = [];
	let saveCalls = 0;
	const res = [];
	const save = () => {
		saveCalls += 1;
		if (saveCalls === 1) return Promise.reject(new Error());
		return Promise.resolve({ ok: true });
	};

	const autosave = createAutosave({ save, onStatus: (s) => st.push(s), timers: t });
	autosave.change();
	t.fire();
	await tick();
	assert.deepStrictEqual(st, ['saving', 'error']);
	assert.deepStrictEqual(t.pending(), [5000]);
	t.fire();
	await tick();
	assert.strictEqual(saveCalls, 2);
	assert.deepStrictEqual(st, ['saving', 'error', 'saved']);
});

test('conflict', async () => {
	const t = fakeTimers();
	const st = [];
	let saveCalls = 0;
	const save = () => {
		saveCalls += 1;
		return Promise.resolve({ conflict: true });
	};

	const autosave = createAutosave({ save, onStatus: (s) => st.push(s), timers: t });
	autosave.change();
	t.fire();
	await tick();
	assert.deepStrictEqual(st, ['saving', 'conflict']);
	assert.deepStrictEqual(t.pending(), []);
	autosave.change();
	assert.deepStrictEqual(t.pending(), []);
	autosave.resume();
	assert.deepStrictEqual(st, ['saving', 'conflict', 'saved']);
});

test('flush', async () => {
	const t = fakeTimers();
	const st = [];
	let saveCalls = 0;
	const save = () => {
		saveCalls += 1;
		return Promise.resolve({ ok: true });
	};

	const autosave = createAutosave({ save, onStatus: (s) => st.push(s), timers: t });
	await autosave.flush();
	assert.strictEqual(saveCalls, 0);
	assert.deepStrictEqual(t.pending(), []);

	autosave.change();
	await autosave.flush();
	assert.strictEqual(saveCalls, 1);
	assert.deepStrictEqual(t.pending(), []);
	assert.strictEqual(autosave.status(), 'saved');
});

test('statusLabel', () => {
	assert.strictEqual(statusLabel('saved'), 'Saved');
	assert.strictEqual(statusLabel('saving'), 'Saving...');
	assert.strictEqual(statusLabel('error'), "Can't save (retrying)");
	assert.strictEqual(statusLabel('conflict'), 'Changed elsewhere');
});