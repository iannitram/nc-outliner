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

/**
 * Rename an outline file. The server also sets the outline's title to the new name.
 *
 * @param {number} fileId outline file id
 * @param {string} name new name, without .opml
 * @return {Promise<{fileId: number, name: string, etag: string}>} the renamed file
 */
export async function renameOutline(fileId, name) {
	try {
		const response = await axios.put(`${outlinesUrl}/${fileId}/name`, { name })
		return response.data
	} catch (error) {
		const err = new Error(error.response?.data?.message || error.message)
		err.response = error.response
		throw err
	}
}

/**
 * @param {number} fileId outline file id
 * @return {Promise<{fileId: number, name: string, etag: string}>} the new copy
 */
export async function duplicateOutline(fileId) {
	const response = await axios.post(`${outlinesUrl}/${fileId}/duplicate`)
	return response.data
}

/**
 * Move an outline to the Nextcloud trash bin.
 *
 * @param {number} fileId outline file id
 */
export async function deleteOutline(fileId) {
	await axios.delete(`${outlinesUrl}/${fileId}`)
}

/**
 * Download the stored .opml file to the computer.
 *
 * @param {number} fileId outline file id
 * @param {string} name file name to save as
 */
export async function downloadOutline(fileId, name) {
	const response = await axios.get(`${outlinesUrl}/${fileId}/download`, { responseType: 'blob' })
	const url = URL.createObjectURL(response.data)
	const link = document.createElement('a')
	link.href = url
	link.download = name
	document.body.appendChild(link)
	link.click()
	link.remove()
	setTimeout(() => URL.revokeObjectURL(url), 1000)
}
