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

/* eslint-disable no-unused-vars -- stub: issue #89 replaces the body */

/**
 * @param {Tree} initial
 * @return {History}
 */
export function createHistory(initial) {
	throw new Error('not implemented yet (#89)')
}
