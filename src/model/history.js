/**
 * Undo and redo over the outline model. Trees are immutable, so a history entry is
 * the tree before the change. Every edit in the app goes through execute().
 * Filled in by issue #89. See CODEMAP.md, "History (undo and redo)".
 *
 * @typedef {import('./outline.js').Tree} Tree
 *
 * @typedef {object} History
 * @property {() => Tree} current
 * @property {(op: (tree: Tree, ...args: any[]) => Tree, args: any[], options?: {mergeKey?: string}) => boolean} execute
 *   runs op(current, ...args); returns false and records nothing when the tree is unchanged
 * @property {() => boolean} undo
 * @property {() => boolean} redo
 * @property {() => boolean} canUndo
 * @property {() => boolean} canRedo
 * @property {(listener: (tree: Tree) => void) => () => void} subscribe called after every change; returns unsubscribe
 */

/**
 * @param {Tree} initial
 * @return {History}
 */
export function createHistory(initial) {
	let tree = initial
	const undoStack = []
	const redoStack = []
	const listeners = new Set()
	let lastMergeKey

	const notify = () => {
		for (const listener of listeners) {
			listener(tree)
		}
	}

	return {
		current: () => tree,
		execute(op, args, { mergeKey } = {}) {
			const next = op(tree, ...args)
			if (next === tree) {
				return false
			}

			if (mergeKey === undefined || mergeKey !== lastMergeKey) {
				undoStack.push(tree)
			}
			redoStack.length = 0
			tree = next
			lastMergeKey = mergeKey
			notify()
			return true
		},
		undo() {
			if (undoStack.length === 0) {
				return false
			}
			redoStack.push(tree)
			tree = undoStack.pop()
			lastMergeKey = undefined
			notify()
			return true
		},
		redo() {
			if (redoStack.length === 0) {
				return false
			}
			undoStack.push(tree)
			tree = redoStack.pop()
			lastMergeKey = undefined
			notify()
			return true
		},
		canUndo: () => undoStack.length > 0,
		canRedo: () => redoStack.length > 0,
		subscribe(listener) {
			listeners.add(listener)
			return () => listeners.delete(listener)
		},
	}
}
