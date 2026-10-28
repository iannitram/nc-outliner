/**
 * Turn an old version's OPML text into a tree of rows for the read-only preview, or null when it is not
 * OPML (never raw text, #180). Rows get synthetic ids (the preview is never saved) and are all expanded.
 *
 * @param {string} text the version's file text
 * @return {import('./outline.js').Tree|null} the rows, or null
 */
export function parseVersionTree(text) {
	if (typeof text !== 'string') {
		return null
	}
	// A saved file may start with a BOM or whitespace, which makes DOMParser fail on the XML declaration.
	const clean = text.replace(/^\uFEFF/, '').replace(/^\s+/, '')
	if (clean === '') {
		return null
	}
	let doc
	try {
		doc = new DOMParser().parseFromString(clean, 'application/xml')
	} catch {
		return null
	}
	if (doc.getElementsByTagName('parsererror').length > 0) {
		return null
	}
	const root = doc.documentElement
	if (!root || root.localName !== 'opml') {
		return null
	}
	// Match by local name, so the namespace prefixes (nco:, or none) never matter.
	const body = Array.from(root.children).find((child) => child.localName === 'body')
	if (!body) {
		return null
	}
	let counter = 0
	const walk = (node) => Array.from(node.children)
		.filter((child) => child.localName === 'outline')
		.map((child) => ({
			id: `version-row-${counter++}`,
			text: child.getAttribute('text') ?? '',
			note: child.getAttribute('_note') ?? '',
			collapsed: false,
			noteHidden: false,
			children: walk(child),
		}))
	return walk(body)
}
