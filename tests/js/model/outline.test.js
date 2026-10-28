import { describe, expect, it } from 'vitest'
import { indent, insertAfter, moveDown, moveTo, moveUp, outdent, remove, sortRows, updateRow } from '../../../src/model/outline.js'

function startTree() {
	return [
		{ id: 'A', text: 'A', note: '', collapsed: false, children: [
			{ id: 'A1', text: 'A1', note: '', collapsed: false, children: [] },
			{ id: 'A2', text: 'A2', note: '', collapsed: false, children: [] },
		] },
		{ id: 'B', text: 'B', note: '', collapsed: false, children: [] },
		{ id: 'C', text: 'C', note: '', collapsed: false, children: [] },
	]
}

const rowX = () => ({ id: 'X', text: 'X', note: '', collapsed: false, children: [] })
const rowIds = (rows) => rows.map((row) => [row.id, rowIds(row.children)])

describe('outline model operations', () => {
	it('inserts after a nested row as its next sibling', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = insertAfter(tree, 'A1', rowX())
		expect(rowIds(result)).toEqual([['A', [['A1', []], ['X', []], ['A2', []]]], ['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('inserts after a root row', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = insertAfter(tree, 'C', rowX())
		expect(rowIds(result)).toEqual([['A', [['A1', []], ['A2', []]]], ['B', []], ['C', []], ['X', []]])
		expect(tree).toEqual(before)
	})

	it('removes a row and its children', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(rowIds(remove(tree, 'A'))).toEqual([['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('removes a nested row', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(rowIds(remove(tree, 'A2'))).toEqual([['A', [['A1', []]]], ['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('moves a root row up with its children', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(rowIds(moveUp(tree, 'B'))).toEqual([['B', []], ['A', [['A1', []], ['A2', []]]], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('moves a nested row down among its siblings', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(rowIds(moveDown(tree, 'A1'))).toEqual([['A', [['A2', []], ['A1', []]]], ['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('returns the original tree when a move or removal cannot apply', () => {
		const tree = startTree()
		expect(moveUp(tree, 'A')).toBe(tree)
		expect(moveDown(tree, 'C')).toBe(tree)
		expect(moveUp(tree, 'A1')).toBe(tree)
		expect(remove(tree, 'nope')).toBe(tree)
	})

	it('leaves the starting tree unchanged after every operation', () => {
		const operations = [
			(tree) => insertAfter(tree, 'A1', rowX()),
			(tree) => insertAfter(tree, 'C', rowX()),
			(tree) => remove(tree, 'A'),
			(tree) => remove(tree, 'A2'),
			(tree) => moveUp(tree, 'B'),
			(tree) => moveDown(tree, 'A1'),
			(tree) => moveUp(tree, 'A'),
			(tree) => moveDown(tree, 'C'),
			(tree) => moveUp(tree, 'A1'),
			(tree) => remove(tree, 'nope'),
		]
		for (const operation of operations) {
			const tree = startTree()
			const before = structuredClone(tree)
			operation(tree)
			expect(tree).toEqual(before)
		}
	})

	it('indents a root row into the previous root row as its last child', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = indent(tree, 'B')
		expect(rowIds(result)).toEqual([['A', [['A1', []], ['A2', []], ['B', []]]], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('returns the input tree itself when indenting the first row at its level', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(indent(tree, 'A')).toBe(tree)
		expect(tree).toEqual(before)
	})

	it('indents a nested row into its previous sibling', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = indent(tree, 'A2')
		expect(rowIds(result)).toEqual([['A', [['A1', [['A2', []]]]]], ['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('outdents the last child of a row to become the next sibling of its parent', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = outdent(tree, 'A2')
		expect(rowIds(result)).toEqual([['A', [['A1', []]]], ['A2', []], ['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('outdents an earlier child while leaving later siblings with the parent', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = outdent(tree, 'A1')
		expect(rowIds(result)).toEqual([['A', [['A2', []]]], ['A1', []], ['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('returns the input tree itself when outdenting a root row', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(outdent(tree, 'B')).toBe(tree)
		expect(tree).toEqual(before)
	})

	it('indents a row with its own children moving with it', () => {
		const tree = [
			{ id: 'A', text: 'A', note: '', collapsed: false, children: [] },
			{ id: 'B', text: 'B', note: '', collapsed: false, children: [
				{ id: 'B1', text: 'B1', note: '', collapsed: false, children: [] },
			] },
		]
		const before = structuredClone(tree)
		const result = indent(tree, 'B')
		expect(rowIds(result)).toEqual([['A', [['B', [['B1', []]]]]]])
		expect(tree).toEqual(before)
	})

	it('outdents a row with its own children moving with it', () => {
		const tree = [
			{ id: 'A', text: 'A', note: '', collapsed: false, children: [
				{ id: 'A1', text: 'A1', note: '', collapsed: false, children: [
					{ id: 'A1_1', text: 'A1_1', note: '', collapsed: false, children: [] },
				] },
				{ id: 'A2', text: 'A2', note: '', collapsed: false, children: [] },
			] },
		]
		const before = structuredClone(tree)
		const result = outdent(tree, 'A1')
		expect(rowIds(result)).toEqual([['A', [['A2', []]]], ['A1', [['A1_1', []]]]])
		expect(tree).toEqual(before)
	})

	it('returns the original tree when indent or outdent cannot apply', () => {
		const tree = startTree()
		expect(indent(tree, 'A')).toBe(tree)
		expect(indent(tree, 'A1')).toBe(tree)
		expect(indent(tree, 'nope')).toBe(tree)
		expect(outdent(tree, 'A')).toBe(tree)
		expect(outdent(tree, 'B')).toBe(tree)
		expect(outdent(tree, 'C')).toBe(tree)
		expect(outdent(tree, 'nope')).toBe(tree)
	})

	it('leaves the starting tree unchanged after every indent and outdent call', () => {
		const operations = [
			(tree) => indent(tree, 'B'),
			(tree) => indent(tree, 'A'),
			(tree) => indent(tree, 'A2'),
			(tree) => indent(tree, 'A1'),
			(tree) => indent(tree, 'nope'),
			(tree) => outdent(tree, 'A2'),
			(tree) => outdent(tree, 'A1'),
			(tree) => outdent(tree, 'B'),
			(tree) => outdent(tree, 'A'),
			(tree) => outdent(tree, 'nope'),
		]
		for (const operation of operations) {
			const tree = startTree()
			const before = structuredClone(tree)
			operation(tree)
			expect(tree).toEqual(before)
		}
	})

	it('updates text while preserving unchanged branch references', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = updateRow(tree, 'A1', { text: 'x' })
		expect(result[0].children[0].text).toBe('x')
		expect(result[0].children[1]).toBe(tree[0].children[1])
		expect(result[1]).toBe(tree[1])
		expect(result[2]).toBe(tree[2])
		expect(tree).toEqual(before)
	})

	it('updates note and collapsed together', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = updateRow(tree, 'B', { note: 'n', collapsed: true })
		expect(result[1]).toMatchObject({ note: 'n', collapsed: true })
		expect(tree).toEqual(before)
	})

	it('ignores unknown keys and returns the input tree when nothing changes', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(updateRow(tree, 'A', { children: [] })).toBe(tree)
		expect(updateRow(tree, 'A1', { text: 'A1' })).toBe(tree)
		expect(tree).toEqual(before)
	})

	it('returns the input tree when the row is not found', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(updateRow(tree, 'nope', { text: 'x' })).toBe(tree)
		expect(tree).toEqual(before)
	})

	it('sorts siblings by topic without separating their children or changing the input', () => {
		const tree = [
			{ id: 'b', text: 'beta', note: '', collapsed: false, children: [
				{ id: 'b2', text: 'z child', note: '', collapsed: false, children: [] },
				{ id: 'b1', text: 'a child', note: '', collapsed: false, children: [] },
			] },
			{ id: 'a', text: 'Alpha', note: '', collapsed: false, children: [] },
		]
		const before = structuredClone(tree)
		const result = sortRows(tree, 'text')
		expect(rowIds(result)).toEqual([['a', []], ['b', [['b1', []], ['b2', []]]]])
		expect(tree).toEqual(before)
	})

	it('sorts descending by note and by checkbox status', () => {
		const tree = [
			{ id: 'none', text: '', note: '', extra: { _status: 'unchecked' }, children: [] },
			{ id: 'done', text: '', note: 'zeta', extra: { _status: 'checked' }, children: [] },
			{ id: 'unknown', text: '', note: 'alpha', children: [] },
		]
		expect(sortRows(tree, 'note', 'desc').map((row) => row.id)).toEqual(['done', 'unknown', 'none'])
		expect(sortRows(tree, 'status').map((row) => row.id)).toEqual(['none', 'unknown', 'done'])
	})

	it('keeps stable order on ties and returns the original tree for invalid or no-op sorts', () => {
		const tree = [
			{ id: 'a', text: 'same', note: '', children: [] },
			{ id: 'b', text: 'same', note: '', children: [] },
		]
		expect(sortRows(tree, 'text')).toBe(tree)
		expect(sortRows(tree, 'unknown')).toBe(tree)
		expect(sortRows(tree, 'text', 'sideways')).toBe(tree)
	})
})

describe('moveTo', () => {
	it('reorders a row among its siblings', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = moveTo(tree, 'C', null, 0)
		expect(rowIds(result)).toEqual([['C', []], ['A', [['A1', []], ['A2', []]]], ['B', []]])
		expect(tree).toEqual(before)
	})

	it('nests a row under a new parent with its children', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = moveTo(tree, 'B', 'A', 2)
		expect(rowIds(result)).toEqual([['A', [['A1', []], ['A2', []], ['B', []]]], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('moves a nested row to the top level', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = moveTo(tree, 'A1', null, 1)
		expect(rowIds(result)).toEqual([['A', [['A2', []]]], ['A1', []], ['B', []], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('carries a row and all its children to a new place', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		const result = moveTo(tree, 'A', 'B', 0)
		expect(rowIds(result)).toEqual([['B', [['A', [['A1', []], ['A2', []]]]]], ['C', []]])
		expect(tree).toEqual(before)
	})

	it('returns the input tree when the parent is the row or inside its subtree', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(moveTo(tree, 'A', 'A', 0)).toBe(tree)
		expect(moveTo(tree, 'A', 'A1', 0)).toBe(tree)
		expect(tree).toEqual(before)
	})

	it('returns the input tree for a missing row, a missing parent or an unchanged move', () => {
		const tree = startTree()
		const before = structuredClone(tree)
		expect(moveTo(tree, 'nope', null, 0)).toBe(tree)
		expect(moveTo(tree, 'B', 'nope', 0)).toBe(tree)
		expect(moveTo(tree, 'B', null, 1)).toBe(tree)
		expect(moveTo(tree, 'A1', 'A', 0)).toBe(tree)
		expect(tree).toEqual(before)
	})
})
