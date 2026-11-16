import { describe, expect, it } from 'vitest'
import { createHistory } from '../../../src/model/history.js'
import { indent, insertAfter, moveDown, moveUp, newRow, outdent, remove, updateRow } from '../../../src/model/outline.js'

function fixture() {
	return [
		{ id: 'a', text: 'A', note: '', collapsed: false, extra: { _status: 'checked', type: 'checkbox' }, children: [
			{ id: 'child', text: 'Child', note: '', collapsed: false, extra: { created: '2026-10-01', 'custom:value': 'kept' }, children: [] },
		] },
		{ id: 'b', text: 'B', note: '', collapsed: false, extra: { owner: 'source' }, children: [] },
		{ id: 'c', text: 'C', note: '', collapsed: false, extra: {}, children: [] },
	]
}

function byId(rows, found = new Map()) {
	for (const row of rows) {
		found.set(row.id, row)
		byId(row.children, found)
	}
	return found
}

function freezeRows(rows) {
	for (const row of rows) {
		Object.freeze(row.extra)
		freezeRows(row.children)
		Object.freeze(row)
	}
	return Object.freeze(rows)
}

describe('opaque OPML metadata through editing (#140)', () => {
	it.each([
		['insert', (tree) => insertAfter(tree, 'child', newRow('New'))],
		['remove', (tree) => remove(tree, 'b')],
		['move up', (tree) => moveUp(tree, 'b')],
		['move down', (tree) => moveDown(tree, 'b')],
		['indent', (tree) => indent(tree, 'b')],
		['outdent', (tree) => outdent(tree, 'child')],
		['edit text', (tree) => updateRow(tree, 'child', { text: 'Edited' })],
		['edit note', (tree) => updateRow(tree, 'a', { note: 'Note' })],
		['collapse', (tree) => updateRow(tree, 'a', { collapsed: true })],
	])('%s preserves extra on every surviving row', (_name, operation) => {
		const before = freezeRows(fixture())
		const original = byId(before)
		const after = operation(before)
		for (const [id, row] of byId(after)) {
			if (original.has(id)) {
				expect(row.extra).toBe(original.get(id).extra)
				expect(row.extra).toEqual(original.get(id).extra)
			}
		}
	})

	it('restores metadata through merged edits, structural undo and redo', () => {
		const initial = freezeRows(fixture())
		const history = createHistory(initial)
		history.execute(updateRow, ['child', { text: 'First' }], { mergeKey: 'text:child' })
		history.execute(updateRow, ['child', { text: 'Final' }], { mergeKey: 'text:child' })
		const edited = history.current()
		history.execute(outdent, ['child'])
		const moved = history.current()
		history.undo()
		expect(history.current()).toBe(edited)
		history.undo()
		expect(history.current()).toBe(initial)
		history.redo()
		history.redo()
		expect(history.current()).toBe(moved)
		expect(byId(moved).get('child').extra).toBe(initial[0].children[0].extra)
	})

	it('retains outline headExtra when replacing edited rows for a save', () => {
		const outline = { title: 'Source', rows: freezeRows(fixture()) }
		const payload = JSON.parse(JSON.stringify({ ...outline, rows: updateRow(outline.rows, 'a', { text: 'Edited' }) }))
		expect(payload.rows[0].extra).toEqual(outline.rows[0].extra)
		expect(payload.rows[0].text).toBe('Edited')
	})
})
