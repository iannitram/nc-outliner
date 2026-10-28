// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
/**
 * TEMPORARY crash log (issue #177). Sends uncaught errors, unhandled promise rejections, Vue
 * component errors and the app's own save failures to POST /apps/nc_outliner/api/clientlog, where
 * the server writes each one to Nextcloud's log. Does nothing unless the page says crash_log is '1'.
 *
 * Privacy: only a sanitized message, the reduced stack, the app and Nextcloud versions, the view
 * (ids replaced by :id), the user agent, a random id per page load and the time are sent. Nothing
 * from the DOM, the outline or the error object's other properties is read. Quoted text becomes "…",
 * URLs, query strings and file names or paths are replaced by <url> and <file>, and stack frames keep only file:line:col for the app's own
 * scripts. The server runs the same rules again (ClientLogController).
 *
 * @typedef {{level: 'error'|'warning', kind: 'error'|'rejection'|'vue'|'save', message: string, stack: string, appVersion: string, ncVersion: string, view: string, userAgent: string, pageId: string, time: string}} CrashEvent
 */

import axios from '@nextcloud/axios'
import { generateUrl } from '@nextcloud/router'

const CLIENT_LOG_PATH = '/apps/nc_outliner/api/clientlog'
const WINDOW_MS = 60000
const MAX_PER_WINDOW = 20
const BATCH_MS = 2000
const MAX_INPUT = 8192
const MAX_MESSAGE = 500
const MAX_STACK = 2048
const MAX_VIEW = 100
const MAX_USER_AGENT = 200
const QUOTED = /'[^']*'|"[^"]*"|`[^`]*`/g
const UNPAIRED_QUOTE = /['"`]/
const FULL_URL = /[a-z][a-z0-9+.-]*:\/\/\S*/gi
const QUERY_OR_FRAGMENT = /[?#]\S*/g
// A path with a file extension; a path whose name has spaces (up to 3 more words, then a word with an
// extension); any other token with a path separator; a bare file name with an extension.
const FILE_LIKE = /\S*[\\/]\S*\.[A-Za-z0-9]{1,6}(?![A-Za-z0-9])|\S*[\\/]\S*(?:\s+[^\s\\/]+){0,3}?\s+[^\s\\/]+\.[A-Za-z0-9]{1,6}(?![A-Za-z0-9])|\S*[\\/]\S*|[^\s,;:()<>[\]{}]*\.[A-Za-z0-9]{1,6}(?![A-Za-z0-9])/g
const FRAME_LINE = /^\s*at\s|@/
const FRAME_LOCATION = /([^\s()@]+):(\d+):(\d+)\)?\s*$/
const APP_FILE = /^nc_outliner[\w.-]*\.m?js$/
const ROUTE_WORD = /^[a-z_-]{1,20}$/

/** @type {null | {appVersion: string, ncVersion: string, pageId: string, accepted: number[], pending: CrashEvent[], timer: ReturnType<typeof setTimeout> | null, busy: boolean, listeners: Array<[string, EventListener]>}} */
let state = null

/**
 * Removes quoted text, unpaired quotes, full URLs ("<url>"), query strings and fragments, and
 * anything that looks like a file name or path ("<file>") from a message.
 *
 * @param {unknown} text message text
 * @param {boolean} [keepPaths] true for a user agent: only quotes, URLs, queries and fragments go
 * @return {string} the sanitized text
 */
export function sanitizeText(text, keepPaths = false) {
	let out = String(text).slice(0, MAX_INPUT).replace(QUOTED, '…')
	const quote = out.search(UNPAIRED_QUOTE)
	if (quote !== -1) {
		out = `${out.slice(0, quote)}…`
	}
	out = out.replace(FULL_URL, '<url>').replace(QUERY_OR_FRAGMENT, '')
	if (!keepPaths) {
		out = out.replace(FILE_LIKE, '<file>')
	}
	return out.slice(0, MAX_MESSAGE)
}

/**
 * Reduces a stack to one "at file:line:col" line per frame. Only the app's own scripts keep their
 * file name; every other file is "<other>". Lines that are not frames are dropped.
 *
 * @param {unknown} stack the raw stack text
 * @return {string} the reduced stack, at most 2 KB
 */
export function sanitizeStack(stack) {
	const frames = []
	for (const line of String(stack ?? '').slice(0, MAX_INPUT).split(/\r?\n/)) {
		const location = FRAME_LOCATION.exec(line)
		if (location && FRAME_LINE.test(line)) {
			frames.push(`at ${frameFile(location[1])}:${location[2]}:${location[3]}`)
		}
	}
	return frames.join('\n').slice(0, MAX_STACK)
}

/**
 * Replaces ids with ":id" and keeps only plain route words in a hash path or pathname.
 *
 * @param {unknown} raw the hash path or pathname
 * @return {string} the view
 */
export function sanitizeView(raw) {
	const text = String(raw ?? '')
	const hashed = text.startsWith('#')
	const path = (hashed ? text.slice(1) : text).split('?')[0]
	const parts = path.split('/').map((part) => {
		if (part === '' || part === ':id') {
			return part
		}
		if (/^\d+$/.test(part)) {
			return ':id'
		}
		return ROUTE_WORD.test(part) ? part : '…'
	})
	return `${hashed ? '#' : ''}${parts.join('/')}`.slice(0, MAX_VIEW)
}

/**
 * Starts the crash log for this page. Does nothing unless config.crashLog is '1'.
 *
 * @param {{crashLog?: string, appVersion?: string, ncVersion?: string}} [config] the mount element's data attributes
 */
export function installCrashLog(config = {}) {
	disposeCrashLog()
	if (config.crashLog !== '1') {
		return
	}
	const listeners = [
		['error', (event) => {
			const value = event.error !== undefined ? event.error : event.message
			capture('error', 'error', () => describe(value))
		}],
		['unhandledrejection', (event) => {
			capture('error', 'rejection', () => describe(event.reason))
		}],
	]
	state = {
		appVersion: clean(config.appVersion),
		ncVersion: clean(config.ncVersion),
		pageId: newPageId(),
		accepted: [],
		pending: [],
		timer: null,
		busy: false,
		listeners,
	}
	for (const [type, listener] of listeners) {
		window.addEventListener(type, listener)
	}
}

/** Stops the crash log: removes the listeners and drops anything waiting to be sent. */
export function disposeCrashLog() {
	const current = state
	if (!current) {
		return
	}
	state = null
	clearTimeout(current.timer)
	for (const [type, listener] of current.listeners) {
		window.removeEventListener(type, listener)
	}
}

/**
 * Reports Vue component errors. Keeps any handler that was already set, and logs to the console
 * when none was, as Vue does by default.
 *
 * @param {import('vue').App} app the Vue app, before mount
 */
export function attachVueErrorHandler(app) {
	const previous = app.config.errorHandler
	app.config.errorHandler = (error, instance, info) => {
		capture('error', 'vue', () => describe(error))
		if (previous) {
			previous(error, instance, info)
		} else {
			// Vue logs to the console by default; keep that once a handler is set.
			// eslint-disable-next-line no-console
			console.error(error)
		}
	}
}

/**
 * Reports one of the app's own caught failures (a failed save or a conflict) as a warning.
 * Pass a fixed description, never the error text or any outline content.
 *
 * @param {string} text fixed description, for example "save failed"
 */
export function crashLogWarning(text) {
	capture('warning', 'save', () => ({ message: sanitizeText(text), stack: '' }))
}

/**
 * Admits one event under the per-minute limit, or drops it, and arms the batch timer.
 * Never throws and never reports its own failures.
 *
 * @param {'error'|'warning'} level the event level
 * @param {CrashEvent['kind']} kind the event kind
 * @param {() => {message: string, stack: string}} make builds the sanitized text; called only when admitted
 */
function capture(level, kind, make) {
	const current = state
	if (!current || current.busy) {
		return
	}
	current.busy = true
	try {
		const now = Date.now()
		current.accepted = current.accepted.filter((at) => now - at < WINDOW_MS)
		if (current.accepted.length >= MAX_PER_WINDOW) {
			return
		}
		const { message, stack } = make()
		current.accepted.push(now)
		current.pending.push({
			level,
			kind,
			message,
			stack,
			appVersion: current.appVersion,
			ncVersion: current.ncVersion,
			view: sanitizeView(window.location.hash || window.location.pathname),
			userAgent: sanitizeText(navigator.userAgent, true).slice(0, MAX_USER_AGENT),
			pageId: current.pageId,
			time: new Date(now).toISOString(),
		})
		if (current.timer === null) {
			current.timer = setTimeout(flush, BATCH_MS)
		}
	} catch {
		// The crash log must not throw, and a failure here is not reported again.
	} finally {
		current.busy = false
	}
}

/** Sends up to 20 waiting events in one POST. A failed POST is dropped, not retried or reported. */
function flush() {
	const current = state
	if (!current) {
		return
	}
	current.timer = null
	const events = current.pending.splice(0, MAX_PER_WINDOW)
	if (events.length > 0) {
		try {
			Promise.resolve(axios.post(generateUrl(CLIENT_LOG_PATH), { events })).catch(() => {})
		} catch {
			// Dropped on purpose.
		}
	}
	if (current.pending.length > 0) {
		current.timer = setTimeout(flush, BATCH_MS)
	}
}

/**
 * Turns a thrown value into a sanitized message and stack. Only the name and message of an Error
 * are read; any other thrown value is described by its type alone.
 *
 * @param {unknown} value the thrown value
 * @return {{message: string, stack: string}}
 */
function describe(value) {
	if (value === null || typeof value !== 'object' || typeof value.message !== 'string') {
		return { message: `non-Error value thrown (${value === null ? 'null' : typeof value})`, stack: '' }
	}
	const name = typeof value.name === 'string' && /^\w{1,40}$/.test(value.name) ? value.name : 'Error'
	return {
		message: sanitizeText(`${name}: ${value.message}`),
		stack: typeof value.stack === 'string' ? sanitizeStack(value.stack) : '',
	}
}

/**
 * @param {string} url the script URL from a stack frame
 * @return {string} the file name for the app's own scripts, otherwise "<other>"
 */
function frameFile(url) {
	const path = url.split(/[?#]/)[0].replaceAll('\\', '/')
	const leaf = path.slice(path.lastIndexOf('/') + 1)
	return APP_FILE.test(leaf) ? leaf : '<other>'
}

/**
 * @param {unknown} value a version string
 * @return {string} the value when it is a plain version, otherwise ""
 */
function clean(value) {
	const text = String(value ?? '')
	return /^[\w.-]{0,32}$/.test(text) ? text : ''
}

/** @return {string} a random id for this page load */
function newPageId() {
	const bytes = globalThis.crypto.getRandomValues(new Uint8Array(12))
	return Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
}
