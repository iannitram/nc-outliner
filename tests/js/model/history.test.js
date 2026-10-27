import { describe, expect, it, vi } from 'vitest'
import { createHistory } from '../../../src/model/history.js'

const append = (tree, value) => [...tree, value]
const same = (tree) => tree

describe('createHistory', () => {
	it('1. executes an operation and exposes the current tree', () => {
		const history = createHistory([])

		expect(history.execute(append, ['a'])).toBe(true)
		expect(history.current()).toEqual(['a'])
	})

	it('2. undoes one step at a time and returns false when empty', () => {
		const history = createHistory([])
		history.execute(append, ['a'])
		history.execute(append, ['b'])

		expect(history.undo()).toBe(true)
		expect(history.current()).toEqual(['a'])
		expect(history.undo()).toBe(true)
		expect(history.current()).toEqual([])
		expect(history.undo()).toBe(false)
		expect(history.current()).toEqual([])
	})

	it('3. redoes one step at a time after two undos', () => {
		const history = createHistory([])
		history.execute(append, ['a'])
		history.execute(append, ['b'])
		history.undo()
		history.undo()

		expect(history.redo()).toBe(true)
		expect(history.current()).toEqual(['a'])
		expect(history.redo()).toBe(true)
		expect(history.current()).toEqual(['a', 'b'])
		expect(history.redo()).toBe(false)
	})

	it('4. clears redo after a new execute', () => {
		const history = createHistory([])
		history.execute(append, ['a'])
		history.execute(append, ['b'])
		history.undo()

		history.execute(append, ['c'])
		expect(history.current()).toEqual(['a', 'c'])
		expect(history.canRedo()).toBe(false)
	})

	it('5. records no history for an unchanged tree', () => {
		const history = createHistory([])

		expect(history.execute(same, [])).toBe(false)
		expect(history.canUndo()).toBe(false)
	})

	it('6. merges consecutive edits with the same key and forgets it after undo', () => {
		const history = createHistory([])
		history.execute(append, ['a'], { mergeKey: 'text:r1' })
		history.execute(append, ['b'], { mergeKey: 'text:r1' })
		history.execute(append, ['c'], { mergeKey: 'text:r1' })

		expect(history.undo()).toBe(true)
		expect(history.current()).toEqual([])

		history.execute(append, ['a'], { mergeKey: 'text:r1' })
		history.undo()
		history.execute(append, ['b'], { mergeKey: 'text:r1' })
		expect(history.undo()).toBe(true)
		expect(history.current()).toEqual([])
	})

	it('7. notifies subscribers for changes and stops after unsubscribe', () => {
		const history = createHistory([])
		const listener = vi.fn()
		const unsubscribe = history.subscribe(listener)

		history.execute(append, ['a'])
		history.undo()
		history.redo()
		expect(listener.mock.calls.map(([tree]) => tree)).toEqual([['a'], [], ['a']])

		unsubscribe()
		history.undo()
		expect(listener).toHaveBeenCalledTimes(3)
	})
})
