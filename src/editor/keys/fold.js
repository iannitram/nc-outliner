/**
 * Keys for collapsing and expanding rows. See src/editor/keymap.js and
 * CODEMAP.md, "Keyboard".
 */
import { updateRow } from '../../model/outline.js'

/**
 * @param {import('../keymap.js').KeyInfo} event the key event
 * @param {import('../keymap.js').KeyContext} context the focused row state
 * @return {string|null}
 */
export function binding(event, context) {
	if (event.shiftKey || event.ctrlKey || event.altKey || event.metaKey) {
		return null
	}
	if (event.key === 'ArrowLeft' && context.caretAtStart && context.hasChildren && !context.collapsed) {
		return 'collapse'
	}
	if (event.key === 'ArrowRight' && context.caretAtEnd && context.collapsed) {
		return 'expand'
	}
	return null
}

/** @type {Record<string, (ctx: import('../keymap.js').CommandContext) => void>} */
export const commands = {
	collapse({ history, rowId }) {
		history.execute(updateRow, [rowId, { collapsed: true }])
	},
	expand({ history, rowId }) {
		history.execute(updateRow, [rowId, { collapsed: false }])
	},
}
