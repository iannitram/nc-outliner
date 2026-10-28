/**
 * Keys for: delete a row, move up and move down. Filled in by issue #95.
 * See src/editor/keymap.js for the contract and CODEMAP.md, "Keyboard".
 */
import { moveDown, moveUp, remove } from '../../model/outline.js'
import { modKey } from '../keymap.js'

/**
 * @param {import('../keymap.js').KeyInfo} event
 * @param {import('../keymap.js').KeyContext} context
 * @return {string|null}
 */
export function binding(event, context) {
	const noOtherModifier = !event.shiftKey && !event.ctrlKey && !event.metaKey
	if (event.key === 'ArrowUp' && event.altKey && noOtherModifier) {
		return 'moveUp'
	}
	if (event.key === 'ArrowDown' && event.altKey && noOtherModifier) {
		return 'moveDown'
	}
	const correctModifier = context.isMac
		? event.metaKey && !event.ctrlKey
		: event.ctrlKey && !event.metaKey
	if (event.key === 'Backspace' && event.shiftKey && modKey(event, context) && correctModifier && !event.altKey) {
		return 'deleteRow'
	}
	return null
}

/** @type {Record<string, (ctx: import('../keymap.js').CommandContext) => void>} */
export const commands = {
	deleteRow(ctx) {
		const tree = ctx.history.current()
		if (tree.length === 1 && tree[0].id === ctx.rowId) {
			return
		}
		const location = locate(tree, ctx.rowId)
		if (!location) {
			return
		}
		const { siblings, index, parentId } = location
		const focusId = siblings[index + 1]?.id ?? siblings[index - 1]?.id ?? parentId
		ctx.history.execute(remove, [ctx.rowId])
		if (focusId) {
			ctx.focus(focusId, 'end')
		}
	},
	moveUp(ctx) {
		ctx.history.execute(moveUp, [ctx.rowId])
		ctx.focus(ctx.rowId)
	},
	moveDown(ctx) {
		ctx.history.execute(moveDown, [ctx.rowId])
		ctx.focus(ctx.rowId)
	},
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
