/**
 * Keys for: Tab and Shift+Tab. Filled in by issue #92.
 * See src/editor/keymap.js for the contract and CODEMAP.md, "Keyboard".
 */

import { indent, outdent } from '../../model/outline.js'

/**
 * @param {import('../keymap.js').KeyInfo} event
 * @param {import('../keymap.js').KeyContext} context
 * @return {string|null}
 */
export function binding(event /* , context */) {
	if (event.key === 'Tab') {
		if (!event.shiftKey && !event.ctrlKey && !event.altKey) {
			return 'indent'
		} else if (event.shiftKey && !event.ctrlKey && !event.altKey) {
			return 'outdent'
		}
	}
	return null
}

/** @type {Record<string, (ctx: import('../keymap.js').CommandContext) => void>} */
export const commands = {
	indent(ctx) {
		const executed = ctx.history.execute(indent, [ctx.rowId])
		if (executed) {
			ctx.focus(ctx.rowId)
		}
	},
	outdent(ctx) {
		const executed = ctx.history.execute(outdent, [ctx.rowId])
		if (executed) {
			ctx.focus(ctx.rowId)
		}
	},
}
