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

	// #224: Firefox's plain text from a Nextcloud Office (Collabora) copy is the text followed by
	// Collabora's own clipboard blocks: a type line, a hex byte length, then the data.
	const collabora = 'One two – three.\n\n\t\t \ntext/markdown\n12\n- One two – three.\n'
		+ 'text/plain;charset=utf-8\n13\nOne two – three.\n'
		+ 'application/x-openoffice-link;windows_formatname="Link"\nb8\nsoffice/tmp/doc.docx\u0001\u0008\n'
		+ 'application/x-openoffice-objectdescriptor-xml;windows_formatname="Star Object Descriptor (XML)"\n94\n�e\u0001~@\u0008$'

	it('keeps only the copied text from a Collabora clipboard', () => {
		expect(clipboardText(clipboard({ 'text/plain': collabora }))).toBe('One two – three.')
	})

	it('takes the text/plain block when nothing comes before the Collabora blocks', () => {
		const blocksOnly = collabora.slice(collabora.indexOf('text/markdown'))
		expect(clipboardText(clipboard({ 'text/plain': blocksOnly }))).toBe('One two – three.')
	})

	it('drops control characters XML cannot hold, keeping tabs and line breaks (#225)', () => {
		expect(clipboardText(clipboard({ 'text/plain': 'a\u0001b\u0008c\td\ne￿' }))).toBe('abc\td\ne')
	})

	it('leaves ordinary text that mentions a type name alone', () => {
		const text = 'Set the header to\ntext/markdown\nand reload.'
		expect(clipboardText(clipboard({ 'text/plain': text }))).toBe(text)
	})

	it('leaves ordinary text alone when a type name is followed by a hex-looking line', () => {
		for (const text of [
			'Supported types:\nimage/png\n1\nimage/jpeg\n2\nend',
			'Headers\napplication/json\n200\nOK body',
			'text/csv\nface\nmore',
			'text/plain\n10\nten bytes',
		]) {
			expect(clipboardText(clipboard({ 'text/plain': text }))).toBe(text)
		}
	})

	it('drops a lone surrogate but keeps characters outside the basic plane', () => {
		expect(clipboardText(clipboard({ 'text/plain': 'a\uD800b😀c' }))).toBe('ab😀c')
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
