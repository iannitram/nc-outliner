/**
 * The outline model: pure functions over a tree of rows. Every operation returns a
 * new tree and never changes its input; a row's children always move with it.
 * See CODEMAP.md, "Outline model".
 *
 * @typedef {object} Row
 * @property {string} id stable id, kept in the file as nco:id
 * @property {string} text
 * @property {string} note
 * @property {boolean} collapsed
 * @property {Row[]} children
 * @property {Record<string, unknown>} [extra] opaque OPML attributes retained by every edit
 *
 * @typedef {Row[]} Tree the root rows, in order
 */

/**
 * A new empty row with a fresh id.
 *
 * @param {string} [text]
 * @return {Row}
 */
export function newRow(text = '') {
	return { id: newId(), text, note: '', collapsed: false, children: [] }
}

/**
 * A random row id. crypto.randomUUID only exists on HTTPS or localhost pages, so a
 * test Nextcloud reached over plain HTTP falls back to getRandomValues.
 *
 * @return {string}
 */
export function newId() {
	if (typeof crypto.randomUUID === 'function') {
		return crypto.randomUUID()
	}
	const bytes = crypto.getRandomValues(new Uint8Array(16))
	return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('')
}

/** Find a row and its sibling array, returning the index path from the root. */
function findPath(rows, id, path = []) {
	for (let i = 0; i < rows.length; i++) {
		const next = [...path, i]
		if (rows[i].id === id) {
			return next
		}
		const childPath = findPath(rows[i].children, id, next)
		if (childPath) {
			return childPath
		}
	}
	return null
}

/** Replace the sibling array identified by a path, copying arrays along the path. */
function changeSiblings(tree, path, change) {
	const [index, ...rest] = path
	if (rest.length === 0) {
		return change(tree, index)
	}
	const row = tree[index]
	const children = changeSiblings(row.children, rest, change)
	if (children === row.children) {
		return tree
	}
	const copy = tree.slice()
	copy[index] = { ...row, children }
	return copy
}

/** Issue #86. @param {Tree} tree @param {string} id @param {Row} row @return {Tree} */
export function insertAfter(tree, id, row) {
	const path = findPath(tree, id)
	if (!path) {
		return tree
	}
	return changeSiblings(tree, path, (siblings, index) => {
		const copy = siblings.slice()
		copy.splice(index + 1, 0, row)
		return copy
	})
}

/** Issue #86. @param {Tree} tree @param {string} id @return {Tree} */
export function remove(tree, id) {
	const path = findPath(tree, id)
	if (!path) {
		return tree
	}
	return changeSiblings(tree, path, (siblings, index) => {
		const copy = siblings.slice()
		copy.splice(index, 1)
		return copy
	})
}

/** Issue #86. @param {Tree} tree @param {string} id @return {Tree} */
export function moveUp(tree, id) {
	const path = findPath(tree, id)
	if (!path || path[path.length - 1] === 0) {
		return tree
	}
	return changeSiblings(tree, path, (siblings, index) => {
		const copy = siblings.slice()
		;[copy[index - 1], copy[index]] = [copy[index], copy[index - 1]]
		return copy
	})
}

/** Issue #86. @param {Tree} tree @param {string} id @return {Tree} */
export function moveDown(tree, id) {
	const path = findPath(tree, id)
	if (!path) {
		return tree
	}
	return changeSiblings(tree, path, (siblings, index) => {
		if (index === siblings.length - 1) {
			return siblings
		}
		const copy = siblings.slice()
		;[copy[index], copy[index + 1]] = [copy[index + 1], copy[index]]
		return copy
	})
}

/** Issue #104. @param {Tree} tree @param {string} id @return {Tree} */
export function indent(tree, id) {
	const path = findPath(tree, id)
	if (!path || path[path.length - 1] === 0) {
		return tree
	}
	return changeSiblings(tree, path, (siblings, index) => {
		const prev = siblings[index - 1]
		const row = siblings[index]
		const newPrev = { ...prev, children: [...prev.children, row] }
		const copy = siblings.slice()
		copy.splice(index - 1, 2, newPrev)
		return copy
	})
}

/** Issue #104. @param {Tree} tree @param {string} id @return {Tree} */
export function outdent(tree, id) {
	const path = findPath(tree, id)
	if (!path || path.length < 2) {
		return tree
	}
	const childIndex = path[path.length - 1]
	return changeSiblings(tree, path.slice(0, -1), (siblings, parentIndex) => {
		const parent = siblings[parentIndex]
		const row = parent.children[childIndex]
		const children = parent.children.slice()
		children.splice(childIndex, 1)
		const newParent = { ...parent, children }
		const copy = siblings.slice()
		copy.splice(parentIndex, 1, newParent, row)
		return copy
	})
}

/**
 * Issue #105. Set text, note or collapsed on one row.
 *
 * @param {Tree} tree
 * @param {string} id
 * @param {{text?: string, note?: string, collapsed?: boolean}} patch
 * @return {Tree}
 */
export function updateRow(tree, id, patch) {
	const path = findPath(tree, id)
	if (!path) {
		return tree
	}
	const row = path.slice(0, -1).reduce((siblings, index) => siblings[index].children, tree)[path[path.length - 1]]
	const updates = {}
	for (const key of ['text', 'note', 'collapsed']) {
		if (Object.hasOwn(patch, key) && patch[key] !== row[key]) {
			updates[key] = patch[key]
		}
	}
	if (Object.keys(updates).length === 0) {
		return tree
	}
	return changeSiblings(tree, path, (siblings, index) => {
		const copy = siblings.slice()
		copy[index] = { ...row, ...updates }
		return copy
	})
}
