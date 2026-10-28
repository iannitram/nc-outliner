/**
 * Browser client for the app's JSON API (CODEMAP.md, "API"). Every call works as the
 * signed-in user; the server never trusts a path from the browser, only file ids.
 * Filled in by issue #106.
 *
 * @typedef {import('../model/outline.js').Tree} Tree
 * @typedef {{fileId: number, name: string, mtime: number}} OutlineEntry
 * @typedef {{title: string, rows: Tree, publishPath: string|null}} OutlineDoc
 */

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

const outlinesUrl = generateUrl('/apps/nc_outliner/api/outlines')

/** @return {Promise<OutlineEntry[]>} */
export async function listOutlines() {
	const response = await axios.get(outlinesUrl)
	return response.data
}

/** @param {string} name @return {Promise<{fileId: number, name: string, etag: string}>} */
export async function createOutline(name) {
	const response = await axios.post(outlinesUrl, { name })
	return response.data
}

/** @param {number} fileId @return {Promise<{fileId: number, name: string, etag: string, outline: OutlineDoc}>} */
export async function readOutline(fileId) {
	const response = await axios.get(`${outlinesUrl}/${fileId}`)
	return response.data
}

/**
 * @param {number} fileId
 * @param {OutlineDoc} outline
 * @param {string} etag the etag the browser last saw
 * @return {Promise<{ok: true, etag: string}|{conflict: true, etag: string}>}
 */
export async function saveOutline(fileId, outline, etag) {
	try {
		const response = await axios.put(`${outlinesUrl}/${fileId}`, { outline }, {
			headers: { 'If-Match': etag },
		})
		return { ok: true, etag: response.data.etag }
	} catch (error) {
		if (error.response?.status === 412) {
			return { conflict: true, etag: error.response.data.etag }
		}
		throw error
	}
}

/** @param {number} fileId @param {OutlineDoc} outline @return {Promise<{fileId: number, name: string, etag: string}>} */
export async function saveCopy(fileId, outline) {
	const response = await axios.post(`${outlinesUrl}/${fileId}/copy`, { outline })
	return response.data
}
