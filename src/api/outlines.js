/**
 * Browser client for the app's JSON API (CODEMAP.md, "API"). Every call works as the
 * signed-in user; the server never trusts a path from the browser, only file ids.
 * Filled in by issue #106.
 *
 * @typedef {import('../model/outline.js').Tree} Tree
 * @typedef {{fileId: number, name: string, mtime: number}} OutlineEntry
 * @typedef {{title: string, rows: Tree, publishPath: string|null}} OutlineDoc
 */

/* eslint-disable no-unused-vars -- stubs: issue #106 replaces the bodies */

/** @return {Promise<OutlineEntry[]>} */
export async function listOutlines() {
	throw new Error('not implemented yet (#106)')
}

/** @param {string} name @return {Promise<{fileId: number, name: string, etag: string}>} */
export async function createOutline(name) {
	throw new Error('not implemented yet (#106)')
}

/** @param {number} fileId @return {Promise<{fileId: number, name: string, etag: string, outline: OutlineDoc}>} */
export async function readOutline(fileId) {
	throw new Error('not implemented yet (#106)')
}

/**
 * @param {number} fileId
 * @param {OutlineDoc} outline
 * @param {string} etag the etag the browser last saw
 * @return {Promise<{ok: true, etag: string}|{conflict: true, etag: string}>}
 */
export async function saveOutline(fileId, outline, etag) {
	throw new Error('not implemented yet (#106)')
}

/** @param {number} fileId @param {OutlineDoc} outline @return {Promise<{fileId: number, name: string, etag: string}>} */
export async function saveCopy(fileId, outline) {
	throw new Error('not implemented yet (#106)')
}
