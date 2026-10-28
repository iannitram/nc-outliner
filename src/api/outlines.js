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
const settingsUrl = generateUrl('/apps/nc_outliner/api/settings')

/** @param {OutlineDoc} outline current edits @return {Promise<string>} OPML from the shared server writer */
export async function exportOpml(outline) {
	const response = await axios.post(generateUrl('/apps/nc_outliner/api/outline-opml'), { outline })
	return response.data.data
}

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

/**
 * @param {number} fileId @param {OutlineDoc} outline @return {Promise<{fileId: number, name: string, etag: string}>}
 * @param outline
 */
export async function saveCopy(fileId, outline) {
	const response = await axios.post(`${outlinesUrl}/${fileId}/copy`, { outline })
	return response.data
}

/**
 * @return {Promise<{theme: 'auto'|'light'|'dark'}>}
 */
export async function getSettings() {
	const response = await axios.get(settingsUrl)
	return response.data
}

/**
 * @param {'auto'|'light'|'dark'} theme user theme preference
 * @return {Promise<{theme: 'auto'|'light'|'dark'}>}
 */
export async function setSettings(theme) {
	const response = await axios.put(settingsUrl, { theme })
	return response.data
}

/**
 * Publish an outline to an .odt file in Nextcloud Files.
 *
 * @param {number} fileId outline file id
 * @param {string} folder destination folder path
 * @param {string} name document name without extension
 * @return {Promise<{fileId: number, path: string, openUrl: string}>} published document info
 */
export async function publish(fileId, folder, name) {
	try {
		const response = await axios.post(`${outlinesUrl}/${fileId}/publish`, { folder, name })
		return response.data
	} catch (error) {
		const message = error.response?.data?.message || (error.response?.status === 404 ? 'Outline not found' : error.message)
		const err = new Error(message)
		err.response = error.response
		throw err
	}
}
