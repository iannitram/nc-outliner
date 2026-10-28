import { describe, expect, it, vi } from 'vitest'
import { binding, commands } from '../../../../src/editor/keys/move.js'
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

describe('move keys', () => {
	it('1. deleteRow on A removes it with its children and focuses B', () => {
		const { history, focus } = run('deleteRow', 'A')

		expect(shape(history.current())).toEqual(['B', 'C'])
		expect(focus).toHaveBeenCalledWith('B', 'end')
	})

	it('2. deleteRow on A2 gives A[A1], B, C and focuses A1', () => {
		const { history, focus } = run('deleteRow', 'A2')

		expect(shape(history.current())).toEqual([{ A: ['A1'] }, 'B', 'C'])
		expect(focus).toHaveBeenCalledWith('A1', 'end')
	})

	it('3. moveUp on B gives B, A[A1, A2], C', () => {
		const { history, focus } = run('moveUp', 'B')

		expect(shape(history.current())).toEqual(['B', { A: ['A1', 'A2'] }, 'C'])
		expect(focus).toHaveBeenCalledWith('B')
	})

	it('4. moveDown on A1 gives A[A2, A1], B, C', () => {
		const { history, focus } = run('moveDown', 'A1')

		expect(shape(history.current())).toEqual([{ A: ['A2', 'A1'] }, 'B', 'C'])
		expect(focus).toHaveBeenCalledWith('A1')
	})

	it('5. moveUp on A and moveDown on C change nothing and add no undo entry', () => {
		const up = run('moveUp', 'A')
		const down = run('moveDown', 'C')

		expect(shape(up.history.current())).toEqual([{ A: ['A1', 'A2'] }, 'B', 'C'])
		expect(up.history.canUndo()).toBe(false)
		expect(shape(down.history.current())).toEqual([{ A: ['A1', 'A2'] }, 'B', 'C'])
		expect(down.history.canUndo()).toBe(false)
	})

	it.each(PLATFORMS)('6. binding maps Alt+Arrow and mod+Shift+Backspace (isMac %s)', (isMac) => {
		expect(binding(key('ArrowUp', { altKey: true }), context(isMac))).toBe('moveUp')
		expect(binding(key('ArrowDown', { altKey: true }), context(isMac))).toBe('moveDown')
		expect(binding(key('ArrowUp'), context(isMac))).toBeNull()
		expect(binding(key('Backspace', { shiftKey: true, ...mod(isMac) }), context(isMac))).toBe('deleteRow')
	})

	it('6b. Ctrl+Shift+Backspace on a Mac is null', () => {
		expect(binding(key('Backspace', { shiftKey: true, ctrlKey: true }), context(true))).toBeNull()
	})
})
