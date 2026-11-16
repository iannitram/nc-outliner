/**
 * Keyboard map for the row editor. Each group in ./keys/ owns some keys:
 * binding(event, context) names a command or returns null, and commands[name]
 * runs it. The editor (issue #91) calls commandForKey on keydown and, when it gets
 * a name, calls preventDefault() and runCommand(). See CODEMAP.md, "Keyboard".
 *
 * @typedef {{key: string, shiftKey: boolean, ctrlKey: boolean, altKey: boolean, metaKey: boolean}} KeyInfo
 * @typedef {{isMac: boolean, rowEmpty: boolean, caretAtStart: boolean, caretAtEnd: boolean, hasChildren: boolean, collapsed: boolean}} KeyContext
 * @typedef {{history: import('../model/history.js').History, rowId: string, caret?: number, focus: (rowId: string, where?: 'start'|'end'|number) => void}} CommandContext
 * @typedef {{binding: (event: KeyInfo, context: KeyContext) => string|null, commands: Record<string, (ctx: CommandContext) => void>}} KeyGroup
 */
import * as editing from './keys/editing.js'
import * as fold from './keys/fold.js'
import * as move from './keys/move.js'
import * as structure from './keys/structure.js'

/** @type {KeyGroup[]} */
export const GROUPS = [editing, structure, move, fold]

/**
 * The primary modifier: Cmd on a Mac, Ctrl on Windows and Linux.
 *
 * @param {KeyInfo} event
 * @param {KeyContext} context
 * @return {boolean}
 */
export function modKey(event, context) {
	return context.isMac ? event.metaKey : event.ctrlKey
}

/**
 * @param {KeyInfo} event
 * @param {KeyContext} context
 * @return {string|null}
 */
export function commandForKey(event, context) {
	for (const group of GROUPS) {
		const name = group.binding(event, context)
		if (name) {
			return name
		}
	}
	return null
}

/**
 * @param {string} name
 * @param {CommandContext} ctx
 */
export function runCommand(name, ctx) {
	for (const group of GROUPS) {
		if (group.commands[name]) {
			group.commands[name](ctx)
			return
		}
	}
	throw new Error(`unknown editor command: ${name}`)
}

/**
 * True on macOS, from the browser's own report.
 *
 * @return {boolean}
 */
export function isMac() {
	const platform = globalThis.navigator?.userAgentData?.platform || globalThis.navigator?.platform || ''
	return /mac/i.test(platform)
}
