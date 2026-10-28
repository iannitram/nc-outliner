import { describe, expect, it, vi } from 'vitest'
import { binding, commands } from '../../../../src/editor/keys/structure.js'
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
function run(name, rowId) {
	const history = createHistory(startTree())
	const focus = vi.fn()
	commands[name]({ history, rowId, focus })
	return { history, focus }
}
const PLATFORMS = [true, false]

describe('structure keys', () => {
	it('1. indent on B gives A[A1, A2, B], C', () => {
		const { history, focus } = run('indent', 'B')

		expect(shape(history.current())).toEqual([{ A: ['A1', 'A2', 'B'] }, 'C'])
		expect(focus).toHaveBeenCalledWith('B')
	})

	it('2. indent on A changes nothing and adds no undo entry', () => {
		const { history } = run('indent', 'A')

		expect(shape(history.current())).toEqual([{ A: ['A1', 'A2'] }, 'B', 'C'])
		expect(history.canUndo()).toBe(false)
	})

	it('3. indent on A2 gives A[A1[A2]], B, C', () => {
		const { history, focus } = run('indent', 'A2')

		expect(shape(history.current())).toEqual([{ A: [{ A1: ['A2'] }] }, 'B', 'C'])
		expect(focus).toHaveBeenCalledWith('A2')
	})

	it('4. outdent on A2 gives A[A1], A2, B, C', () => {
		const { history, focus } = run('outdent', 'A2')

		expect(shape(history.current())).toEqual([{ A: ['A1'] }, 'A2', 'B', 'C'])
		expect(focus).toHaveBeenCalledWith('A2')
	})

	it('5. outdent on B changes nothing', () => {
		const { history } = run('outdent', 'B')

		expect(shape(history.current())).toEqual([{ A: ['A1', 'A2'] }, 'B', 'C'])
		expect(history.canUndo()).toBe(false)
	})

	it.each(PLATFORMS)('6. binding maps Tab, Shift+Tab and Ctrl+Tab (isMac %s)', (isMac) => {
		expect(binding(key('Tab'), context(isMac))).toBe('indent')
		expect(binding(key('Tab', { shiftKey: true }), context(isMac))).toBe('outdent')
		expect(binding(key('Tab', { ctrlKey: true }), context(isMac))).toBeNull()
	})
})
