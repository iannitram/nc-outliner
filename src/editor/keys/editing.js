/**
 * Keys for: Enter, Backspace on an empty row, undo and redo.
 * See src/editor/keymap.js for the contract and CODEMAP.md, "Keyboard".
 */
import { insertAfter, newRow, remove } from '../../model/outline.js'
import { modKey } from '../keymap.js'

/**
 * @param {import('../keymap.js').KeyInfo} event the key event
 * @param {import('../keymap.js').KeyContext} context the editor context
 * @return {string|null}
 */
export function binding(event, context) {
	if (event.isComposing) {
		return null
	}
	const noModifier = !event.shiftKey && !event.ctrlKey && !event.altKey && !event.metaKey

	if (event.key === 'Enter' && noModifier) {
		return 'newRowBelow'
	}
	if (event.key === 'Backspace' && noModifier && context.rowEmpty) {
		return 'deleteEmptyRow'
	}
	if (event.key === 'z' || event.key === 'Z') {
		const correctModifier = context.isMac
			? event.metaKey && !event.ctrlKey
			: event.ctrlKey && !event.metaKey
		if (modKey(event, context) && correctModifier && !event.altKey) {
			if (event.shiftKey) {
				return 'redo'
			}
			if (!event.shiftKey) {
				return 'undo'
			}
		}
	}
	if (!context.isMac && event.key.toLowerCase() === 'y' && event.ctrlKey && !event.metaKey && !event.altKey && !event.shiftKey) {
		return 'redo'
	}
	return null
}

/** @type {Record<string, (ctx: import('../keymap.js').CommandContext) => void>} */
export const commands = {
	newRowBelow(ctx) {
		const row = newRow()
		if (ctx.history.execute(insertAfter, [ctx.rowId, row])) {
			ctx.focus(row.id, 'start')
		}
	},
	deleteEmptyRow(ctx) {
		const tree = ctx.history.current()
		const location = locate(tree, ctx.rowId)
		if (!location) {
			return
		}
		if (tree.length === 1 && tree[0].id === ctx.rowId) {
			return
		}
		const previous = previousVisibleRow(tree, ctx.rowId)
		const focusId = previous || nextRootAfterRemoval(tree, ctx.rowId)
		const targetRow = location.siblings[location.index]
		const op = targetRow.children.length > 0 ? removeKeepChildren : remove
		ctx.history.execute(op, [ctx.rowId])
		if (focusId) {
			ctx.focus(focusId, 'end')
		}
	},
	undo(ctx) {
		ctx.history.undo()
	},
	redo(ctx) {
		ctx.history.redo()
	},
}

/**
 * Return the row immediately above this one in the visible outline order.
 *
 * @param {import('../../model/outline.js').Tree} tree the outline rows
 * @param {string} id the target row id
 * @return {string|null}
 */
function previousVisibleRow(tree, id) {
	const location = locate(tree, id)
	if (!location) {
		return null
	}
	if (location.index > 0) {
		return lastVisibleDescendant(location.siblings[location.index - 1]).id
	}
	return location.parentId
}

/**
 * @param {import('../../model/outline.js').Row} row a row to inspect
 * @return {import('../../model/outline.js').Row}
 */
function lastVisibleDescendant(row) {
	if (!row.collapsed && row.children.length > 0) {
		return lastVisibleDescendant(row.children[row.children.length - 1])
	}
	return row
}

/**
 * @param {import('../../model/outline.js').Tree} rows sibling rows
 * @param {string} id target row id
 * @param {string|null} [parentId] parent row id
 * @return {{siblings: import('../../model/outline.js').Tree, index: number, parentId: string|null}|null}
 */
function locate(rows, id, parentId = null) {
	for (let index = 0; index < rows.length; index++) {
		const row = rows[index]
		if (row.id === id) {
			return { siblings: rows, index, parentId }
		}
		const child = locate(row.children, id, row.id)
		if (child) {
			return child
		}
	}
	return null
}

/**
 * @param {import('../../model/outline.js').Tree} tree the outline rows
 * @param {string} removedId row being removed
 * @return {string|null}
 */
function nextRootAfterRemoval(tree, removedId) {
	/** @param {import('../../model/outline.js').Tree} rows sibling rows */
	function first(rows) {
		for (const row of rows) {
			if (row.id === removedId) {
				continue
			}
			return row.id
		}
		return null
	}
	return first(tree)
}

/**
 * Issue #107. Delete a row and promote its children into its place.
 *
 * @param {import('../../model/outline.js').Tree} tree the outline rows
 * @param {string} id the target row id
 * @return {import('../../model/outline.js').Tree}
 */
export function removeKeepChildren(tree, id) {
	let changed = false
	const next = []
	for (const row of tree) {
		if (row.id === id) {
			changed = true
			next.push(...row.children)
		} else {
			const children = removeKeepChildren(row.children, id)
			if (children !== row.children) {
				changed = true
				next.push({ ...row, children })
			} else {
				next.push(row)
			}
		}
	}
	return changed ? next : tree
}
