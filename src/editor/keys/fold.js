/**
 * Keys for: collapse and expand with the arrow keys. Filled in by issue #93.
 * See src/editor/keymap.js for the contract and CODEMAP.md, "Keyboard".
 */

/* eslint-disable no-unused-vars -- stub: issue #93 replaces the body */

/**
 * @param {import('../keymap.js').KeyInfo} event
 * @param {import('../keymap.js').KeyContext} context
 * @return {string|null}
 */
export function binding(event, context) {
	return null
}

/** @type {Record<string, (ctx: import('../keymap.js').CommandContext) => void>} */
export const commands = {}
