import { describe, expect, it } from 'vitest'
import { clipboardText, insertAtCaret } from '../../../src/editor/clipboard.js'

/**
 * @param {Record<string, string>} types clipboard contents by type
 * @return {{getData: (type: string) => string}} a stand-in clipboard
 */
function clipboard(types) {
	return { getData: (type) => types[type] ?? '' }
}

describe('clipboardText (#220)', () => {
	it('prefers plain text', () => {
		expect(clipboardText(clipboard({ 'text/plain': 'plain', 'text/html': '<b>html</b>' }))).toBe('plain')
	})

	it('falls back to the text of HTML, keeping line breaks', () => {
		expect(clipboardText(clipboard({ 'text/html': '<p>One<br>two</p><p>three &amp; four</p>' }))).toBe('One\ntwo\nthree & four')
	})

	it('gives an empty string when there is no text, as for a copied image', () => {
		expect(clipboardText(clipboard({ 'image/png': 'x' }))).toBe('')
		expect(clipboardText(null)).toBe('')
	})
})

describe('insertAtCaret', () => {
	it('replaces the selection and leaves the caret after the text', () => {
		const el = document.createElement('textarea')
		el.value = 'hello world'
		el.setSelectionRange(6, 11)
		insertAtCaret(el, 'there')
		expect(el.value).toBe('hello there')
		expect(el.selectionStart).toBe(11)
	})
})
