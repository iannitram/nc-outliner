/**
 * The outline model: pure functions over a tree of rows. Every operation returns a
 * new tree and never changes its input; a row's children always move with it.
 * See CODEMAP.md, "Outline model".
 *
 * @typedef {object} Row
 * @property {string} id stable id, kept in the file as nco:id
 * @property {string} text
 * @property {string} note
 * @property {boolean} collapsed
 * @property {Row[]} children
 *
 * @typedef {Row[]} Tree the root rows, in order
 */

/**
 * A new empty row with a fresh id.
 *
 * @param {string} [text]
 * @return {Row}
 */
export function newRow(text = '') {
	return { id: newId(), text, note: '', collapsed: false, children: [] }
}

/**
 * A random row id. crypto.randomUUID only exists on HTTPS or localhost pages, so a
 * test Nextcloud reached over plain HTTP falls back to getRandomValues.
 *
 * @return {string}
 */
export function newId() {
	if (typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/* eslint-disable no-unused-vars -- stubs: each issue below replaces its body */

/** Issue #86. @param {Tree} tree @param {string} id @param {Row} row @return {Tree} */
export function insertAfter(tree, id, row) {
	throw new Error('not implemented yet (#86)')
}

/** Issue #86. @param {Tree} tree @param {string} id @return {Tree} */
export function remove(tree, id) {
	throw new Error('not implemented yet (#86)')
}

/** Issue #86. @param {Tree} tree @param {string} id @return {Tree} */
export function moveUp(tree, id) {
	throw new Error('not implemented yet (#86)')
}

/** Issue #86. @param {Tree} tree @param {string} id @return {Tree} */
export function moveDown(tree, id) {
	throw new Error('not implemented yet (#86)')
}

/** Issue #104. @param {Tree} tree @param {string} id @return {Tree} */
export function indent(tree, id) {
	throw new Error('not implemented yet (#104)')
}

/** Issue #104. @param {Tree} tree @param {string} id @return {Tree} */
export function outdent(tree, id) {
	throw new Error('not implemented yet (#104)')
}

/**
 * Issue #105. Set text, note or collapsed on one row.
 *
 * @param {Tree} tree
 * @param {string} id
 * @param {{text?: string, note?: string, collapsed?: boolean}} patch
 * @return {Tree}
 */
export function updateRow(tree, id, patch) {
	throw new Error('not implemented yet (#105)')
}
