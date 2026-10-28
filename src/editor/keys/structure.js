/**
 * Keys for: Tab and Shift+Tab.
 * See src/editor/keymap.js for the contract and CODEMAP.md, "Keyboard".
 */
import { indent, outdent } from '../../model/outline.js'

/**
 * @param {import('../keymap.js').KeyInfo} event the key event
 * @param {import('../keymap.js').KeyContext} context the editor context
 * @return {string|null}
 */
export function binding(event, context) {
	void context // The same key bindings apply on both platforms.
	if (event.isComposing || event.ctrlKey || event.altKey || event.metaKey) {
		return null
	}
	if (event.key === 'Tab') {
		return event.shiftKey ? 'outdent' : 'indent'
	}
	return null
}

/** @type {Record<string, (ctx: import('../keymap.js').CommandContext) => void>} */
export const commands = {
	indent(ctx) {
		if (ctx.history.execute(indent, [ctx.rowId])) {
			ctx.focus(ctx.rowId)
		}
	},
	outdent(ctx) {
		if (ctx.history.execute(outdent, [ctx.rowId])) {
			ctx.focus(ctx.rowId)
		}
	},
}
