import { describe, expect, it } from 'vitest'
import { insertAfter, moveDown, moveUp, remove } from '../../../src/model/outline.js'

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
})
