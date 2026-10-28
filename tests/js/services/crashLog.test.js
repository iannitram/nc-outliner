// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
import axios from '@nextcloud/axios'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import {
	attachVueErrorHandler,
	crashLogWarning,
	disposeCrashLog,
	installCrashLog,
	sanitizeStack,
	sanitizeText,
	sanitizeView,
} from '../../../src/services/crashLog.js'

vi.mock('@nextcloud/axios', () => ({ default: { post: vi.fn() } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (path) => path }))

const ON = { crashLog: '1', appVersion: '0.1.0', ncVersion: '33.0.10' }
const ELLIPSIS = '…'
const CANARIES = [
	'CANARY_TEXT_7f3a',
	'CANARY_TITLE_7f3a',
	'CANARY_NOTE_7f3a',
	'CANARY_FILE_7f3a.opml',
	'CANARY_USER_7f3a',
]

// The test run reports an uncaught window 'error' unless it is cancelled. The crash log only
// listens, so the synthetic errors below are cancelled here, in the capture phase.
window.addEventListener('error', (event) => event.preventDefault(), true)

/** @return {Array<Record<string, unknown>>} every event in every POST body, in order */
function sentEvents() {
	return axios.post.mock.calls.flatMap(([, body]) => body.events)
}

/** @return {Error} an error whose stack carries the given text */
function errorWithStack(message, stack) {
	const error = new Error(message)
	error.stack = stack
	return error
}

/** Fires a window 'error' event the way the browser does for an uncaught throw. */
function throwUncaught(error) {
	window.dispatchEvent(new ErrorEvent('error', { error, message: error?.message, cancelable: true }))
}

/** Fires an 'unhandledrejection' event with the given reason. */
function rejectUnhandled(reason) {
	const event = new Event('unhandledrejection')
	event.reason = reason
	window.dispatchEvent(event)
}

beforeEach(() => {
	vi.useFakeTimers()
	axios.post.mockReset()
	axios.post.mockResolvedValue({ data: {} })
	vi.spyOn(console, 'error').mockImplementation(() => {})
})

afterEach(() => {
	disposeCrashLog()
	vi.useRealTimers()
	vi.restoreAllMocks()
	window.location.hash = ''
})

describe('each handler reaches the POST once', () => {
	it('an uncaught error (window error event)', () => {
		installCrashLog(ON)

		throwUncaught(new TypeError('boom'))
		vi.advanceTimersByTime(2000)

		expect(axios.post).toHaveBeenCalledTimes(1)
		const [url, body] = axios.post.mock.calls[0]
		expect(url).toBe('/apps/nc_outliner/api/clientlog')
		expect(body.events).toHaveLength(1)
		expect(body.events[0]).toMatchObject({ level: 'error', kind: 'error', message: 'TypeError: boom', appVersion: '0.1.0', ncVersion: '33.0.10' })
	})

	it('an unhandled promise rejection', () => {
		installCrashLog(ON)

		rejectUnhandled(new RangeError('late'))
		vi.advanceTimersByTime(2000)

		expect(axios.post).toHaveBeenCalledTimes(1)
		expect(sentEvents()).toHaveLength(1)
		expect(sentEvents()[0]).toMatchObject({ level: 'error', kind: 'rejection', message: 'RangeError: late' })
	})

	it('a Vue component error (app.config.errorHandler)', () => {
		installCrashLog(ON)
		const Broken = defineComponent({
			setup() {
				throw new Error('render failed')
			},
			render: () => h('div'),
		})
		const app = createApp(Broken)
		attachVueErrorHandler(app)

		app.mount(document.createElement('div'))
		vi.advanceTimersByTime(2000)

		expect(axios.post).toHaveBeenCalledTimes(1)
		expect(sentEvents()).toHaveLength(1)
		expect(sentEvents()[0]).toMatchObject({ level: 'error', kind: 'vue', message: 'Error: render failed' })
	})

	it('a save warning from the app', () => {
		installCrashLog(ON)

		crashLogWarning('save conflict')
		vi.advanceTimersByTime(2000)

		expect(sentEvents()).toEqual([expect.objectContaining({ level: 'warning', kind: 'save', message: 'save conflict', stack: '' })])
	})
})

describe('privacy: no user content in any POST body', () => {
	it('sends none of the canary strings from the page, the messages or the stacks', () => {
		installCrashLog(ON)
		// A mounted page that shows every canary, like an open outline with a file and a user.
		const page = createApp({
			render: () => h('main', [
				h('span', 'CANARY_TEXT_7f3a'),
				h('h2', 'CANARY_TITLE_7f3a'),
				h('p', 'CANARY_NOTE_7f3a'),
				h('a', 'CANARY_FILE_7f3a.opml'),
				h('footer', 'CANARY_USER_7f3a'),
			]),
		})
		const root = document.createElement('div')
		document.body.append(root)
		page.mount(root)
		attachVueErrorHandler(page)

		throwUncaught(errorWithStack(
			'failed on "CANARY_TEXT_7f3a"',
			[
				'Error: failed on "CANARY_TEXT_7f3a"',
				'    at load (https://nc.example/apps/nc_outliner/js/nc_outliner-main.mjs?v=CANARY_USER_7f3a:12:5)',
				'    at open (https://nc.example/CANARY_FILE_7f3a.opml?x=1:3:4)',
			].join('\n'),
		))
		rejectUnhandled(Object.assign(new Error('cannot read \'CANARY_TITLE_7f3a\' of \'CANARY_NOTE_7f3a\''), {
			stack: [
				'TypeError: cannot read \'CANARY_TITLE_7f3a\'',
				'    at https://nc.example/CANARY_FILE_7f3a.opml?x=1:9:9',
			].join('\n'),
			row: 'CANARY_NOTE_7f3a',
			user: 'CANARY_USER_7f3a',
		}))
		page.config.errorHandler(new Error('row "CANARY_TEXT_7f3a" failed'), null, 'render')
		crashLogWarning('save failed')
		vi.advanceTimersByTime(2000)

		expect(sentEvents()).toHaveLength(4)
		const body = JSON.stringify(axios.post.mock.calls)
		for (const canary of CANARIES) {
			expect(body).not.toContain(canary)
		}
		expect(sentEvents()[0].message).toBe(`Error: failed on ${ELLIPSIS}`)
		expect(sentEvents()[0].stack).toBe('at nc_outliner-main.mjs:12:5\nat <other>:3:4')
		root.remove()
	})

	it('replaces a full URL, and drops its query and fragment', () => {
		expect(sanitizeText('Failed: https://nc.example/a/b.opml?file=CANARY_FILE_7f3a#CANARY_NOTE_7f3a')).toBe('Failed: <url>')
	})

	it('redacts unquoted file names, paths, URLs and query strings, keeping the plain words', () => {
		const cases = [
			['failed to open Plan.opml', 'failed to open <file>', ['Plan']],
			['save failed for /Outlines/Secret Plan.opml', 'save failed for <file>', ['Outlines', 'Secret', 'Plan']],
			['C:\\Users\\x\\file.txt', '<file>', ['Users', 'file.txt']],
			['GET https://host/apps/x?token=abc#frag', 'GET <url>', ['host', 'token', 'abc', 'frag']],
			['item 42?draft=1', 'item 42', ['draft']],
			['wrote my-notes.odt and a.b.c.txt', 'wrote <file> and <file>', ['notes', 'a.b']],
			['Error: x in CANARY_FILE_9z.opml?x=1', 'Error: x in <file>', ['CANARY', 'x=1']],
		]
		for (const [input, expected, absent] of cases) {
			const out = sanitizeText(input)
			expect(out).toBe(expected)
			for (const word of absent) {
				expect(out).not.toContain(word)
			}
		}
	})

	it('leaves a normal message unchanged', () => {
		expect(sanitizeText('TypeError: Cannot read properties of undefined (reading \'x\')')).toBe(`TypeError: Cannot read properties of undefined (reading ${ELLIPSIS})`)
		expect(sanitizeText('TypeError: Cannot read properties of undefined')).toBe('TypeError: Cannot read properties of undefined')
	})
})

describe('the live canary case', () => {
	it('keeps the row text, the file name and its query out of the POST body', () => {
		installCrashLog(ON)
		throwUncaught(new Error('CRASHTEST_A uncaught on "CANARY_ROW_9z" in CANARY_FILE_9z.opml?x=1'))
		vi.advanceTimersByTime(2000)
		const body = JSON.stringify(axios.post.mock.calls)
		for (const leaked of ['CANARY_ROW_9z', 'CANARY_FILE_9z', 'x=1']) {
			expect(body).not.toContain(leaked)
		}
		expect(sentEvents()[0].message).toBe(`Error: CRASHTEST_A uncaught on ${ELLIPSIS} in <file>`)
	})
})

describe('rate limit', () => {
	it('sends 20 of 30 errors in a minute, and the other 10 never', () => {
		installCrashLog(ON)

		for (let i = 0; i < 30; i++) {
			throwUncaught(new Error(`error ${i}`))
		}
		vi.advanceTimersByTime(2000)
		expect(sentEvents()).toHaveLength(20)

		vi.advanceTimersByTime(10 * 60 * 1000)
		expect(sentEvents()).toHaveLength(20)
		expect(axios.post).toHaveBeenCalledTimes(1)
	})

	it('admits events again once the minute has passed', () => {
		installCrashLog(ON)
		for (let i = 0; i < 25; i++) {
			throwUncaught(new Error(`first ${i}`))
		}
		vi.advanceTimersByTime(61000)

		throwUncaught(new Error('later'))
		vi.advanceTimersByTime(2000)

		expect(sentEvents()).toHaveLength(21)
		expect(sentEvents()[20].message).toBe('Error: later')
	})
})

describe('switch', () => {
	it('with crash_log off, nothing is ever POSTed', () => {
		installCrashLog({ ...ON, crashLog: '0' })
		const app = createApp(defineComponent({
			setup() {
				throw new Error('x')
			},
			render: () => h('div'),
		}))
		attachVueErrorHandler(app)

		throwUncaught(new Error('a'))
		rejectUnhandled(new Error('b'))
		crashLogWarning('save failed')
		app.mount(document.createElement('div'))
		vi.advanceTimersByTime(60 * 60 * 1000)

		expect(axios.post).not.toHaveBeenCalled()
	})

	it('with no config at all, nothing is ever POSTed', () => {
		installCrashLog()

		throwUncaught(new Error('a'))
		vi.advanceTimersByTime(2000)

		expect(axios.post).not.toHaveBeenCalled()
	})
})

describe('failed POST', () => {
	it('does not throw and produces no further event', () => {
		installCrashLog(ON)
		axios.post.mockRejectedValueOnce(new Error('offline'))

		throwUncaught(new Error('first'))
		expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
		vi.advanceTimersByTime(60 * 1000)

		expect(axios.post).toHaveBeenCalledTimes(1)
	})

	it('does not throw when axios itself throws synchronously', () => {
		installCrashLog(ON)
		axios.post.mockImplementationOnce(() => {
			throw new Error('no axios')
		})

		throwUncaught(new Error('first'))
		expect(() => vi.advanceTimersByTime(2000)).not.toThrow()
		expect(axios.post).toHaveBeenCalledTimes(1)
	})
})

describe('what is kept from the page and the error', () => {
	it('sends the route with ids replaced, and a random id that is per page load', () => {
		window.location.hash = '#/outline/42'
		installCrashLog(ON)
		throwUncaught(new Error('a'))
		vi.advanceTimersByTime(2000)

		expect(sentEvents()[0]).toMatchObject({ view: '#/outline/:id' })
		expect(sentEvents()[0].pageId).toMatch(/^[0-9a-f]{24}$/)
	})

	it('describes a thrown non-Error by its type only', () => {
		installCrashLog(ON)
		throwUncaught('CANARY_TEXT_7f3a')
		vi.advanceTimersByTime(2000)

		expect(sentEvents()[0].message).toBe('non-Error value thrown (string)')
	})
})

describe('sanitizers', () => {
	it('replaces every quoted substring and cuts at an unpaired quote', () => {
		expect(sanitizeText('a \'b\' "c" `d` e')).toBe(`a ${ELLIPSIS} ${ELLIPSIS} ${ELLIPSIS} e`)
		expect(sanitizeText('cannot read "x of row')).toBe(`cannot read ${ELLIPSIS}`)
	})

	it('replaces typographic quotes too, and cuts at an unpaired one', () => {
		expect(sanitizeText('Error: “CANARY_TEXT_7f3a” and «CANARY_NOTE_7f3a»')).toBe(`Error: ${ELLIPSIS} and ${ELLIPSIS}`)
		expect(sanitizeText('Error: can’t find CANARY_TITLE_7f3a')).toBe(`Error: can${ELLIPSIS}`)
	})

	it('turns control characters and line separators into spaces (no log injection)', () => {
		expect(sanitizeText('Error: a\r\nFAKE\tb\u2028c\u001bd')).toBe('Error: a  FAKE b c d')
		expect(sanitizeText('Mozilla/5.0\r\nFAKE', true)).toBe('Mozilla/5.0  FAKE')
	})

	it('keeps only app script file names in a stack and cuts it to 2 KB', () => {
		expect(sanitizeStack('Error: x\n    at f (https://h/apps/nc_outliner/js/nc_outliner-main.mjs?v=1:1:2)\n    at g (https://h/other.js:3:4)\n    at <anonymous>')).toBe('at nc_outliner-main.mjs:1:2\nat <other>:3:4')
		const long = '    at f (https://h/apps/nc_outliner/js/nc_outliner-main.mjs:1:2)\n'.repeat(200)
		expect(sanitizeStack(long).length).toBeLessThanOrEqual(2048)
	})

	it('replaces ids in a view and keeps only route words', () => {
		expect(sanitizeView('#/outline/7')).toBe('#/outline/:id')
		expect(sanitizeView('#/outline/CANARY_TITLE_7f3a')).toBe(`#/outline/${ELLIPSIS}`)
	})
})
