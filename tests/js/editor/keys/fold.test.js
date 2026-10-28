import { describe, expect, it, vi } from 'vitest'
import { binding, commands } from '../../../../src/editor/keys/fold.js'
import { createHistory } from '../../../../src/model/history.js'

const baseContext = {
	isMac: false,
	rowEmpty: false,
	caretAtStart: false,
	caretAtEnd: false,
	hasChildren: false,
	collapsed: false,
}

describe('fold keys', () => {
	it('binds only Left at the start of an expanded parent and Right at the end of a collapsed row', () => {
		expect(binding({ key: 'ArrowLeft' }, { ...baseContext, caretAtStart: true, hasChildren: true })).toBe('collapse')
		expect(binding({ key: 'ArrowRight' }, { ...baseContext, caretAtEnd: true, collapsed: true })).toBe('expand')
		expect(binding({ key: 'ArrowLeft' }, { ...baseContext, caretAtStart: true })).toBeNull()
		expect(binding({ key: 'ArrowRight' }, { ...baseContext, caretAtEnd: true })).toBeNull()
	})

	it('does not bind modified arrow keys', () => {
		expect(binding({ key: 'ArrowLeft', altKey: true }, { ...baseContext, caretAtStart: true, hasChildren: true })).toBeNull()
		expect(binding({ key: 'ArrowRight', ctrlKey: true }, { ...baseContext, caretAtEnd: true, collapsed: true })).toBeNull()
	})

	it.each([
		['collapse', true],
		['expand', false],
	])('%s updates collapsed through History and supports undo', (name, collapsed) => {
		const row = { id: 'r1', text: 'Parent', note: '', collapsed: !collapsed, children: [] }
		const history = createHistory([row])
		const execute = vi.spyOn(history, 'execute')

		commands[name]({ history, rowId: 'r1', focus: vi.fn() })

		expect(execute).toHaveBeenCalled()
		expect(history.current()[0].collapsed).toBe(collapsed)
		expect(history.undo()).toBe(true)
		expect(history.current()[0].collapsed).toBe(!collapsed)
	})
})
