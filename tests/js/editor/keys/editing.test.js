import { describe, expect, it, vi } from 'vitest'
import { binding, commands } from '../../../../src/editor/keys/editing.js'
import { createHistory } from '../../../../src/model/history.js'

function deepFreeze(value) {
	if (value && typeof value === 'object' && !Object.isFrozen(value)) {
		Object.freeze(value)
		Object.values(value).forEach(deepFreeze)
	}
	return value
}

const row = (id, ...children) => ({ id, text: id, note: '', collapsed: false, children })
const startTree = () => deepFreeze([row('A', row('A1'), row('A2')), row('B'), row('C')])
const shape = (tree) => tree.map((r) => (r.children.length ? { [r.id]: shape(r.children) } : r.id))

const key = (k, overrides = {}) => deepFreeze({ key: k, shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, ...overrides })
const context = (isMac, overrides = {}) => deepFreeze({ isMac, rowEmpty: false, caretAtStart: false, caretAtEnd: false, hasChildren: false, collapsed: false, ...overrides })
const mod = (isMac) => (isMac ? { metaKey: true } : { ctrlKey: true })
function run(name, rowId) {
	const history = createHistory(startTree())
	const focus = vi.fn()
	commands[name]({ history, rowId, focus })
	return { history, focus }
}
const PLATFORMS = [true, false]

describe('editing keys', () => {
	it('1. newRowBelow on A1 gives A[A1, new, A2], B, C and focuses the new row at start', () => {
		const { history, focus } = run('newRowBelow', 'A1')

		const tree = history.current()
		const [a1, created, a2] = tree[0].children
		expect([a1.id, a2.id]).toEqual(['A1', 'A2'])
		expect(created.id).not.toMatch(/^(A|A1|A2|B|C)$/)
		expect(shape(tree)).toEqual([{ A: ['A1', created.id, 'A2'] }, 'B', 'C'])
		expect(focus).toHaveBeenCalledTimes(1)
		expect(focus).toHaveBeenCalledWith(created.id, 'start')
	})

	it('2a. deleteEmptyRow on B gives A[A1, A2], C and focuses A2 at end', () => {
		const { history, focus } = run('deleteEmptyRow', 'B')

		expect(shape(history.current())).toEqual([{ A: ['A1', 'A2'] }, 'C'])
		expect(focus).toHaveBeenCalledWith('A2', 'end')
	})

	it('2b. deleteEmptyRow on A1 focuses A at end', () => {
		const { focus } = run('deleteEmptyRow', 'A1')

		expect(focus).toHaveBeenCalledWith('A', 'end')
	})

	it.each(PLATFORMS)('3. binding names the editing commands (isMac %s)', (isMac) => {
		expect(binding(key('Enter'), context(isMac))).toBe('newRowBelow')
		expect(binding(key('Enter', { shiftKey: true }), context(isMac))).toBeNull()
		expect(binding(key('Backspace'), context(isMac, { rowEmpty: true }))).toBe('deleteEmptyRow')
		expect(binding(key('Backspace'), context(isMac, { rowEmpty: false }))).toBeNull()
		expect(binding(key('z', mod(isMac)), context(isMac))).toBe('undo')
		expect(binding(key('Z', mod(isMac)), context(isMac))).toBe('undo')
		expect(binding(key('z', { shiftKey: true, ...mod(isMac) }), context(isMac))).toBe('redo')
		expect(binding(key('Z', { shiftKey: true, ...mod(isMac) }), context(isMac))).toBe('redo')
		expect(binding(key('z'), context(isMac))).toBeNull()
	})

	it('3b. Ctrl+Y is redo when isMac is false and null when true', () => {
		expect(binding(key('y', { ctrlKey: true }), context(false))).toBe('redo')
		expect(binding(key('y', { metaKey: true }), context(true))).toBeNull()
	})

	it('4. newRowBelow then undo gives the start tree and redo gives it back', () => {
		const start = startTree()
		const history = createHistory(start)
		commands.newRowBelow({ history, rowId: 'A1', focus: vi.fn() })
		const after = history.current()

		commands.undo({ history, rowId: 'A1', focus: vi.fn() })
		expect(history.current()).toBe(start)

		commands.redo({ history, rowId: 'A1', focus: vi.fn() })
		expect(history.current()).toBe(after)
	})
})
