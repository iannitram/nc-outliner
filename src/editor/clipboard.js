/**
 * Text to paste from a clipboard event (#220). Plain text when the clipboard has it; otherwise the
 * text of copied HTML, since some sources put only HTML on the clipboard and a text field then
 * pastes nothing. Line breaks from <br> and block ends are kept.
 *
 * @param {DataTransfer|null|undefined} clipboardData the paste event's clipboard
 * @return {string} the text, or '' when there is none
 */
export function clipboardText(clipboardData) {
	return withoutIllegalCharacters(rawClipboardText(clipboardData))
}

// A Collabora clipboard block header: a type line, then its data length in hex, each on its own line.
const COLLABORA_BLOCK = /(?:^|\n)((?:text|application|image)\/[^\n]*)\n[0-9a-fA-F]+\n/g

/**
 * The copied text alone (#224). Firefox's plain text from a Nextcloud Office (Collabora) copy is the
 * text followed by Collabora's own blocks (markdown, plain text again, links, binary object data).
 * Keep what comes before them, or the text/plain block when nothing does. Text counts as a Collabora
 * copy only when it holds both a text/plain block and an Office (application/x-openoffice-…) block,
 * so ordinary text that lists a type name and a hex-looking line (image/png, then 1) pastes whole.
 *
 * @param {string} text the clipboard's plain text
 * @return {string} the text without Collabora's blocks
 */
function withoutCollaboraBlocks(text) {
	const blocks = [...text.matchAll(COLLABORA_BLOCK)]
	const isCollabora = blocks.some((block) => block[1].startsWith('text/plain'))
		&& blocks.some((block) => block[1].startsWith('application/x-openoffice-'))
	if (!isCollabora) {
		return text
	}
	const before = text.slice(0, blocks[0].index).trimEnd()
	if (before.trim() !== '') {
		return before
	}
	const plainAt = blocks.findIndex((block) => block[1].startsWith('text/plain'))
	if (plainAt === -1) {
		return ''
	}
	const start = blocks[plainAt].index + blocks[plainAt][0].length
	const end = blocks[plainAt + 1]?.index ?? text.length
	return text.slice(start, end).trim()
}

/**
 * Drop the characters XML cannot hold (#225): a saved outline with one of them cannot be opened again.
 * Tabs and line breaks stay.
 *
 * @param {string} text any text
 * @return {string} the text without them
 */
function withoutIllegalCharacters(text) {
	return text.replace(/[^\t\n\r\u{20}-\u{D7FF}\u{E000}-\u{FFFD}\u{10000}-\u{10FFFF}]/gu, '')
}

/**
 * @param {DataTransfer|null|undefined} clipboardData the paste event's clipboard
 * @return {string} the text, or '' when there is none
 */
function rawClipboardText(clipboardData) {
	const plain = clipboardData?.getData('text/plain') ?? ''
	if (plain !== '') {
		return withoutCollaboraBlocks(plain)
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
