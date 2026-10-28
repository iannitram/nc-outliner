/** Immutable column operations and derived column views for an Outline document. */

const TYPES = new Set(['checkbox', 'number', 'percent', 'currency', 'date', 'duration', 'popup', 'richtext'])

/**
 * @param {string} name @param {string} [type] @return {{id: string, name: string, type: string, width: number, hidden: boolean, summary: string}}
 * @param type
 */
export function newColumn(name, type = 'richtext') {
	if (!TYPES.has(type)) {
		throw new TypeError(`Unsupported column type: ${type}`)
	}
	return { id: newId(), name: name.trim() || 'Column', type, width: 180, hidden: false, summary: 'none', options: [] }
}

/**
 *
 */
function newId() {
	return typeof crypto.randomUUID === 'function' ? crypto.randomUUID() : Array.from(crypto.getRandomValues(new Uint8Array(16)), (b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * @param {object} outline @param {string} name @param {string} [type]
 * @param name
 * @param type
 */
export function addColumn(outline, name, type = 'richtext') {
	return { ...outline, columns: [...(outline.columns ?? []), newColumn(name, type)] }
}

/**
 * @param {object} outline @param {string} id
 * @param id
 */
export function removeColumn(outline, id) {
	if (!(outline.columns ?? []).some((column) => column.id === id)) {
		return outline
	}
	return { ...outline, columns: outline.columns.filter((column) => column.id !== id), rows: mapRows(outline.rows, (row) => {
		if (!Object.hasOwn(row.values ?? {}, id)) {
			return row
		}
		const values = { ...row.values }
		delete values[id]
		return { ...row, values }
	}) }
}

/**
 * @param {object} outline @param {string} id @param {{name?: string, type?: string, width?: number, hidden?: boolean, summary?: string}} patch
 * @param id
 * @param patch
 */
export function updateColumn(outline, id, patch) {
	const columns = outline.columns ?? []
	const index = columns.findIndex((column) => column.id === id)
	if (index < 0) {
		return outline
	}
	if (patch.type !== undefined && !TYPES.has(patch.type)) {
		throw new TypeError(`Unsupported column type: ${patch.type}`)
	}
	const allowed = {}
	for (const key of ['name', 'type', 'width', 'hidden', 'summary', 'options']) {
		if (Object.hasOwn(patch, key)) {
			allowed[key] = patch[key]
		}
	}
	if (allowed.width !== undefined) {
		allowed.width = Math.max(48, Math.min(1200, Math.round(Number(allowed.width) || 48)))
	}
	if (allowed.name !== undefined) {
		allowed.name = String(allowed.name).trim() || 'Column'
	}
	const nextColumn = { ...columns[index], ...allowed }
	if (Object.keys(allowed).every((key) => Object.is(nextColumn[key], columns[index][key]))) {
		return outline
	}
	const nextColumns = columns.slice()
	nextColumns[index] = nextColumn
	return { ...outline, columns: nextColumns }
}

/**
 * @param {object} outline @param {string} rowId @param {string} columnId @param {unknown} value
 * @param rowId
 * @param columnId
 * @param value
 */
export function setColumnValue(outline, rowId, columnId, value) {
	if (!(outline.columns ?? []).some((column) => column.id === columnId)) {
		return outline
	}
	let changed = false
	const rows = mapRows(outline.rows, (row) => {
		if (row.id !== rowId || Object.is(row.values?.[columnId], value)) {
			return row
		}
		changed = true
		const values = { ...(row.values ?? {}) }
		if (value === null || value === undefined || value === '') {
			delete values[columnId]
		} else {
			values[columnId] = value
		}
		return { ...row, values }
	})
	return changed ? { ...outline, rows } : outline
}

/**
 * Sorts each sibling list and descendants, preserving row objects and source tree.
 *
 * @param rows
 * @param column
 * @param direction
 */
export function sortRowsByColumn(rows, column, direction = 'asc') {
	const multiplier = direction === 'desc' ? -1 : 1
	return rows.map((row) => ({ ...row, children: sortRowsByColumn(row.children ?? [], column, direction) }))
		.map((row, index) => ({ row, index }))
		.sort((a, b) => compare(a.row.values?.[column.id], b.row.values?.[column.id], column.type) * multiplier || a.index - b.index)
		.map((item) => item.row)
}

/**
 * Returns an aggregate over descendant leaves, ignoring empty or invalid numeric values.
 *
 * @param row
 * @param column
 * @param operation
 */
export function summarizeColumn(row, column, operation) {
	const values = []
	const visit = (current) => {
		if (current.children?.length) {
			current.children.forEach(visit)
		} else if (current.values && Object.hasOwn(current.values, column.id)) {
			values.push(current.values[column.id])
		}
	}
	(row.children ?? []).forEach(visit)
	if (column.type === 'checkbox') {
		const checked = values.filter(Boolean).length
		return operation === 'count' ? `${checked}/${values.length}` : values.length > 0 && checked === values.length
	}
	if (!['number', 'percent', 'currency', 'duration'].includes(column.type)) {
		return null
	}
	const numbers = values.map(Number).filter(Number.isFinite)
	if (numbers.length === 0) {
		return null
	}
	if (operation === 'min') {
		return Math.min(...numbers)
	}
	if (operation === 'max') {
		return Math.max(...numbers)
	}
	if (operation === 'average') {
		return numbers.reduce((sum, value) => sum + value, 0) / numbers.length
	}
	return numbers.reduce((sum, value) => sum + value, 0)
}

/**
 *
 * @param left
 * @param right
 * @param type
 */
function compare(left, right, type) {
	const leftEmpty = left === null || left === undefined
	const rightEmpty = right === null || right === undefined
	if (leftEmpty && rightEmpty) {
		return 0
	}
	if (leftEmpty) {
		return 1
	}
	if (rightEmpty) {
		return -1
	}
	if (['number', 'percent', 'currency', 'duration'].includes(type)) {
		const a = Number(left)
		const b = Number(right)
		return Number.isFinite(a) && Number.isFinite(b) ? a - b : String(left).localeCompare(String(right))
	}
	if (type === 'checkbox') {
		return Number(Boolean(left)) - Number(Boolean(right))
	}
	if (type === 'date') {
		return String(left).localeCompare(String(right))
	}
	return String(left).localeCompare(String(right), undefined, { numeric: true, sensitivity: 'base' })
}

/**
 *
 * @param rows
 * @param update
 */
function mapRows(rows, update) {
	let changed = false
	const next = rows.map((row) => {
		const children = mapRows(row.children ?? [], update)
		const updated = update(row)
		if (updated !== row || children !== row.children) {
			changed = true
		}
		return children !== row.children ? { ...updated, children } : updated
	})
	return changed ? next : rows
}
