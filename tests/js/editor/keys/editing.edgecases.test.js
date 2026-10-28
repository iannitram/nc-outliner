import { describe, expect, it, vi } from 'vitest'
import { binding, commands } from '../../../../src/editor/keys/editing.js'
import { createHistory } from '../../../../src/model/history.js'

describe('editing key edge cases', () => {
	it('keeps the only root row when it contains children', () => {
		const tree = [{ id: 'parent', text: '', note: '', collapsed: false, children: [
			{ id: 'child', text: '', note: '', collapsed: false, children: [] },
		] }]
		const history = createHistory(tree)
		const focus = vi.fn()

		commands.deleteEmptyRow({ history, rowId: 'parent', focus })

		expect(history.current()).toBe(tree)
		expect(history.canUndo()).toBe(false)
		expect(focus).not.toHaveBeenCalled()
	})

	it('does not focus a row when Enter targets an unknown row id', () => {
		const history = createHistory([])
		const focus = vi.fn()

		commands.newRowBelow({ history, rowId: 'missing', focus })

		expect(history.current()).toEqual([])
		expect(focus).not.toHaveBeenCalled()
	})

	it('leaves Enter to the input method editor while composing', () => {
		expect(binding({ key: 'Enter', shiftKey: false, ctrlKey: false, altKey: false, metaKey: false, isComposing: true }, {
			isMac: false,
			rowEmpty: false,
			caretAtStart: false,
			caretAtEnd: false,
			hasChildren: false,
			collapsed: false,
		})).toBeNull()
	})
})
