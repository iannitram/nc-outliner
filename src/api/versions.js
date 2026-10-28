/**
 * Browser client for an outline's versions (CODEMAP.md, "Versions"; ADR 0004).
 * It talks WebDAV to Nextcloud's own versions endpoint, the way the Files app does,
 * as the signed-in user: nobody else's versions can be reached. There is no server code of ours.
 *
 * @typedef {{id: string, time: number, label: string, size: number}} Version
 *   `time` is milliseconds since 1970. The entry whose time equals the file's own modified time is the live file; it
 *   lists and restores like the others, but reading it by id answers 404 (read the file itself).
 */

import { getCurrentUser } from '@nextcloud/auth'
import axios from '@nextcloud/axios'
import { generateRemoteUrl } from '@nextcloud/router'

const DAV = 'DAV:'
const NC = 'http://nextcloud.org/ns'

/**
 *
 */
function root() {
	return `${generateRemoteUrl('dav')}/versions/${getCurrentUser().uid}`
}

/**
 *
 * @param text
 */
function escapeXml(text) {
	return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/**
 * @param {Element} response @param {string} ns @param {string} name
 * @param ns
 * @param name
 */
function okProp(response, ns, name) {
	for (const propstat of response.getElementsByTagNameNS(DAV, 'propstat')) {
		if (!propstat.getElementsByTagNameNS(DAV, 'status')[0]?.textContent.includes(' 200 ')) {
			continue
		}
		const node = propstat.getElementsByTagNameNS(ns, name)[0]
		if (node) {
			return node.textContent
		}
	}
	return null
}

/**
 * The versions of one outline, newest first.
 *
 * @param {number} fileId
 * @return {Promise<Version[]>}
 */
export async function listVersions(fileId) {
	const response = await axios.request({
		method: 'PROPFIND',
		url: `${root()}/versions/${fileId}`,
		headers: { Depth: '1', 'Content-Type': 'application/xml' },
		data: `<?xml version="1.0"?>
<d:propfind xmlns:d="DAV:" xmlns:nc="${NC}"><d:prop><d:getlastmodified/><d:getcontentlength/><nc:version-label/></d:prop></d:propfind>`,
	})
	const doc = new DOMParser().parseFromString(response.data, 'application/xml')
	const versions = []
	for (const entry of doc.getElementsByTagNameNS(DAV, 'response')) {
		const modified = okProp(entry, DAV, 'getlastmodified')
		if (modified === null) {
			continue // the folder itself
		}
		const href = entry.getElementsByTagNameNS(DAV, 'href')[0].textContent
		versions.push({
			id: href.replace(/\/$/, '').split('/').pop(),
			time: Date.parse(modified),
			label: okProp(entry, NC, 'version-label') ?? '',
			size: Number(okProp(entry, DAV, 'getcontentlength') ?? 0),
		})
	}
	return versions.sort((a, b) => b.time - a.time)
}

/**
 * One older version's text, read-only (a GET never changes anything).
 *
 * @param {number} fileId
 * @param {string} id
 * @return {Promise<string>}
 */
export async function readVersion(fileId, id) {
	const response = await axios.get(`${root()}/versions/${fileId}/${id}`, {
		responseType: 'text',
		transformResponse: [(data) => data],
	})
	return response.data
}

/**
 * Make an older version the file again. Nextcloud first keeps the state the file was in as a
 * version, so the restore can be undone.
 *
 * @param {number} fileId
 * @param {string} id
 * @return {Promise<void>}
 */
export async function restoreVersion(fileId, id) {
	await axios.request({
		method: 'MOVE',
		url: `${root()}/versions/${fileId}/${id}`,
		headers: { Destination: `${root()}/restore/target` },
	})
}

/**
 * Name a version; a named version is never cleaned up. An empty label un-names it.
 *
 * @param {number} fileId
 * @param {string} id
 * @param {string} label
 * @return {Promise<void>}
 */
export async function nameVersion(fileId, id, label) {
	await axios.request({
		method: 'PROPPATCH',
		url: `${root()}/versions/${fileId}/${id}`,
		headers: { 'Content-Type': 'application/xml' },
		data: `<?xml version="1.0"?>
<d:propertyupdate xmlns:d="DAV:" xmlns:nc="${NC}"><d:set><d:prop><nc:version-label>${escapeXml(label)}</nc:version-label></d:prop></d:set></d:propertyupdate>`,
	})
}
