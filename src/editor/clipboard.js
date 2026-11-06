/**
 * Text to paste from a clipboard event (#220). Plain text when the clipboard has it; otherwise the
 * text of copied HTML, since some sources put only HTML on the clipboard and a text field then
 * pastes nothing. Line breaks from <br> and block ends are kept.
 *
 * @param {DataTransfer|null|undefined} clipboardData the paste event's clipboard
 * @return {string} the text, or '' when there is none
 */
export function clipboardText(clipboardData) {
	const plain = clipboardData?.getData('text/plain') ?? ''
	if (plain !== '') {
		return plain
	}
	const html = clipboardData?.getData('text/html') ?? ''
	if (html === '') {
		return ''
	}
	const marked = html
		.replace(/<br\s*\/?>/gi, '\n')
		.replace(/<\/(p|div|li|h[1-6]|tr|blockquote|pre)>/gi, '$&\n')
	const body = new DOMParser().parseFromString(marked, 'text/html').body
	return (body?.textContent ?? '').replace(/\n{3,}/g, '\n\n').trim()
}

/**
 * Put text into a text field at its caret, replacing any selection, with the caret after it.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} el the field
 * @param {string} text the text to insert
 */
export function insertAtCaret(el, text) {
	const start = el.selectionStart ?? el.value.length
	const end = el.selectionEnd ?? start
	el.value = el.value.slice(0, start) + text + el.value.slice(end)
	const caret = start + text.length
	el.setSelectionRange?.(caret, caret)
}
