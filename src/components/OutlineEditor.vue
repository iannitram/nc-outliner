<script setup>
import { nextTick, onUnmounted, provide, ref, watch } from 'vue'
import OutlineRow from './OutlineRow.vue'
import * as keymap from '../editor/keymap.js'
import { moveTo, remove, sortRows, updateRow } from '../model/outline.js'

const props = defineProps({
	history: {
		type: Object,
		required: true,
	},
})

const rootRef = ref(null)
const tree = ref(props.history.current())
const activeRowId = ref(null)
const caretPos = ref(0)
const sortBy = ref('text')
const sortDirection = ref('asc')
const dragSourceId = ref(null)
const dropTarget = ref(null)
const inputRefs = new Map()

let unsubscribe = null

/**
 *
 * @param {import('../model/outline.js').Tree} newTree the updated outline tree
 */
function updateTree(newTree) {
	tree.value = newTree
}

watch(
	() => props.history,
	(newHistory) => {
		if (unsubscribe) {
			unsubscribe()
		}
		if (newHistory) {
			tree.value = newHistory.current()
			unsubscribe = newHistory.subscribe(updateTree)
		}
	},
	{ immediate: true },
)

onUnmounted(() => {
	if (unsubscribe) {
		unsubscribe()
	}
})

/**
 *
 * @param {string} rowId the row to focus
 * @param {number|'start'|'end'} where the caret position
 */
function focus(rowId, where = 'start') {
	activeRowId.value = rowId
	let el = inputRefs.get(rowId)
	if (!el && rootRef.value) {
		el = rootRef.value.querySelector(`[data-row-id="${rowId}"] input, input[data-row-id="${rowId}"]`)
	}
	if (el) {
		el.focus()
		const pos = where === 'end' ? el.value.length : (typeof where === 'number' ? where : 0)
		el.setSelectionRange(pos, pos)
	} else {
		nextTick(() => {
			let deferredEl = inputRefs.get(rowId)
			if (!deferredEl && rootRef.value) {
				deferredEl = rootRef.value.querySelector(`[data-row-id="${rowId}"] input, input[data-row-id="${rowId}"]`)
			}
			if (deferredEl) {
				deferredEl.focus()
				const pos = where === 'end' ? deferredEl.value.length : (typeof where === 'number' ? where : 0)
				deferredEl.setSelectionRange(pos, pos)
			}
		})
	}
}

/**
 *
 * @param {import('../model/outline.js').Row} row the edited row
 * @param {InputEvent} event the input event
 */
function handleInput(row, event) {
	const newText = event.target.value
	props.history.execute(updateRow, [row.id, { text: newText }], {
		mergeKey: `text:${row.id}`,
	})
}

/**
 * Toggle a row through History so collapse state can be undone.
 *
 * @param {import('../model/outline.js').Row} row the row to toggle
 */
function toggleCollapsed(row) {
	if (!row.collapsed && activeRowId.value && row.id !== activeRowId.value && containsRow(row, activeRowId.value)) {
		props.history.execute(updateRow, [row.id, { collapsed: true }])
		focus(row.id, caretPos.value)
		return
	}
	props.history.execute(updateRow, [row.id, { collapsed: !row.collapsed }])
}

/**
 * @param {import('../model/outline.js').Row} row the possible ancestor
 * @param {string} id the row id to find
 * @return {boolean}
 */
function containsRow(row, id) {
	return Boolean(row.children && row.children.some((child) => child.id === id || containsRow(child, id)))
}

/**
 *
 * @param {import('../model/outline.js').Row} row the focused row
 * @param {FocusEvent} event the focus event
 */
function handleKeydown(row, event) {
	const input = event.target
	const selStart = input.selectionStart ?? 0
	const selEnd = input.selectionEnd ?? selStart
	const len = input.value?.length ?? 0

	const context = {
		isMac: keymap.isMac(),
		rowEmpty: len === 0,
		caretAtStart: selStart === 0 && selEnd === 0,
		caretAtEnd: selStart === len && selEnd === len,
		hasChildren: Boolean(row.children && row.children.length > 0),
		collapsed: Boolean(row.collapsed),
	}

	const command = keymap.commandForKey(event, context)
	if (command) {
		event.preventDefault()
		keymap.runCommand(command, {
			history: props.history,
			rowId: row.id,
			focus,
		})
	}
}

/**
 *
 * @param {import('../model/outline.js').Row} row the row receiving the key
 * @param {KeyboardEvent} event the keydown event
 */
function handleFocus(row, event) {
	activeRowId.value = row.id
	caretPos.value = event.target.selectionStart ?? 0
}

/** Apply the chosen permanent sort through History so it can be undone. */
function applySort() {
	props.history.execute(sortRows, [sortBy.value, sortDirection.value])
}

/** Switch between ascending and descending order. */
function toggleSortDirection() {
	sortDirection.value = sortDirection.value === 'asc' ? 'desc' : 'asc'
}

/**
 * @param {import('../model/outline.js').Tree} rows the rows to search
 * @param {string} id the row id to find
 * @return {import('../model/outline.js').Row|null}
 */
function findRow(rows, id) {
	for (const row of rows) {
		if (row.id === id) {
			return row
		}
		const found = findRow(row.children ?? [], id)
		if (found) {
			return found
		}
	}
	return null
}

/**
 * @param {import('../model/outline.js').Tree} rows the rows to search
 * @param {string} id the row id to find
 * @param {string|null} parentId the parent of this sibling list
 * @return {{parentId: string|null, index: number}|null}
 */
function findParentInfo(rows, id, parentId = null) {
	for (let index = 0; index < rows.length; index++) {
		if (rows[index].id === id) {
			return { parentId, index }
		}
		const found = findParentInfo(rows[index].children ?? [], id, rows[index].id)
		if (found) {
			return found
		}
	}
	return null
}

/**
 * Work out where in a row the pointer is: its top third means before it, its
 * bottom third means after it, and its middle means nest inside it.
 *
 * @param {DragEvent} event the drag event
 * @return {'before'|'after'|'nest'}
 */
function dropPosition(event) {
	const element = event.currentTarget
	if (!element || typeof element.getBoundingClientRect !== 'function') {
		return 'nest'
	}
	const rect = element.getBoundingClientRect()
	const offset = (event.clientY ?? 0) - rect.top
	if (rect.height > 0) {
		if (offset < rect.height / 3) {
			return 'before'
		}
		if (offset > (rect.height * 2) / 3) {
			return 'after'
		}
	}
	return 'nest'
}

/**
 * @param {import('../model/outline.js').Row} row the row under the pointer
 * @param {DragEvent} event the drag event
 * @return {{rowId: string, position: 'before'|'after'|'nest'}|null}
 */
function dropTargetFor(row, event) {
	const sourceId = dragSourceId.value
	if (!sourceId || row.id === sourceId) {
		return null
	}
	const source = findRow(tree.value, sourceId)
	if (source && containsRow(source, row.id)) {
		return null
	}
	return { rowId: row.id, position: dropPosition(event) }
}

/** @return {boolean} whether a row is being dragged */
function isDragging() {
	return dragSourceId.value !== null
}

/**
 * @param {import('../model/outline.js').Row} row the row being dragged
 */
function startDrag(row) {
	dragSourceId.value = row.id
	dropTarget.value = null
}

/** Finish a drag, whether it ended in a drop or not. */
function endDrag() {
	dragSourceId.value = null
	dropTarget.value = null
}

/**
 * @param {import('../model/outline.js').Row} row the row under the pointer
 * @param {DragEvent} event the dragover event
 */
function dragOverRow(row, event) {
	const target = dropTargetFor(row, event)
	dropTarget.value = target ? { ...target } : null
}

/**
 * Drop the dragged row at the place the pointer names, as one History entry.
 *
 * @param {import('../model/outline.js').Row} row the row under the pointer
 * @param {DragEvent} event the drop event
 */
function dropOnRow(row, event) {
	const sourceId = dragSourceId.value
	const target = dropTargetFor(row, event)
	if (!sourceId || !target) {
		endDrag()
		return
	}

	const without = remove(tree.value, sourceId)
	const info = findParentInfo(without, target.rowId)
	if (!info) {
		endDrag()
		return
	}

	let parentId = info.parentId
	let index = info.index
	if (target.position === 'after') {
		index = info.index + 1
	} else if (target.position === 'nest') {
		const targetRow = findRow(without, target.rowId)
		parentId = target.rowId
		index = targetRow?.children?.length ?? 0
	}

	props.history.execute(moveTo, [sourceId, parentId, index])
	endDrag()
}

provide('outlineEditor', {
	onInput: handleInput,
	toggleCollapsed,
	onKeydown: handleKeydown,
	onFocus: handleFocus,
	isDragging,
	dropTarget,
	startDrag,
	endDrag,
	dragOverRow,
	dropOnRow,
	registerInput: (id, el) => {
		if (el) {
			inputRefs.set(id, el)
		} else {
			inputRefs.delete(id)
		}
	},
	unregisterInput: (id) => {
		inputRefs.delete(id)
	},
})

defineExpose({
	focus,
})
</script>

<template>
	<div
		ref="rootRef"
		class="outline-editor"
		role="tree">
		<div class="outline-sort" role="group" aria-label="Sort outline rows">
			<label>
				Sort rows by
				<select v-model="sortBy" aria-label="Sort rows by">
					<option value="text">Topic</option>
					<option value="status">Status</option>
					<option value="note">Note</option>
				</select>
			</label>
			<button type="button" @click="toggleSortDirection">
				{{ sortDirection === 'asc' ? 'Ascending' : 'Descending' }}
			</button>
			<button type="button" @click="applySort">
				Sort rows
			</button>
		</div>
		<div role="tree">
			<OutlineRow
				v-for="row in tree"
				:key="row.id"
				:row="row">
				<template v-for="(_, name) in $slots" #[name]="slotProps">
					<slot :name="name" v-bind="slotProps" />
				</template>
			</OutlineRow>
		</div>
	</div>
</template>

<style scoped>
/* Level bands: the server's theme colour mixed into the background (ADR 0003 heading levels). */
.outline-editor {
	--band-1: color-mix(in srgb, var(--color-primary-element) 9%, var(--color-main-background));
	--band-2: color-mix(in srgb, var(--color-primary-element) 4%, var(--color-main-background));
	background-color: var(--color-main-background);
	color: var(--color-main-text);
	width: 100%;
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	overflow: auto;
}

[data-themes*=dark] .outline-editor,
body[data-theme-dark] .outline-editor,
[data-theme-dark] .outline-editor {
	--band-1: color-mix(in srgb, var(--color-primary-element) 13%, var(--color-main-background));
	--band-2: color-mix(in srgb, var(--color-primary-element) 6%, var(--color-main-background));
}

/* Nextcloud's "default" theme follows the system setting. */
@media (prefers-color-scheme: dark) {
	[data-themes*=default] .outline-editor,
	body[data-theme-default] .outline-editor {
		--band-1: color-mix(in srgb, var(--color-primary-element) 13%, var(--color-main-background));
		--band-2: color-mix(in srgb, var(--color-primary-element) 6%, var(--color-main-background));
	}

	/* A provider forced to light wins over the system setting (same specificity, later). */
	body [data-theme-light] .outline-editor,
	[data-theme-light] .outline-editor {
		--band-1: color-mix(in srgb, var(--color-primary-element) 9%, var(--color-main-background));
		--band-2: color-mix(in srgb, var(--color-primary-element) 4%, var(--color-main-background));
	}
}

.outline-sort {
	display: flex;
	align-items: center;
	gap: 0.5rem;
	padding: 0.5rem;
}

.outline-sort label {
	display: flex;
	align-items: center;
	gap: 0.35rem;
}
</style>
