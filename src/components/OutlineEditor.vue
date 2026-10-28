<script setup>
import { computed, nextTick, onMounted, onUnmounted, provide, ref, watch } from 'vue'
import KeyboardHints from './KeyboardHints.vue'
import OutlineRow from './OutlineRow.vue'
import * as keymap from '../editor/keymap.js'
import { moveTo, newRow, remove, updateRow } from '../model/outline.js'

const props = defineProps({
	history: {
		type: Object,
		required: true,
	},
	/** Show the rows without any way to change them (a version preview): no inputs, drag, add, delete or sort. */
	readonly: {
		type: Boolean,
		default: false,
	},
})

const rootRef = ref(null)
const tree = ref(props.history.current())
const activeRowId = ref(null)
const caretPos = ref(0)
const dragSourceId = ref(null)
const dropTarget = ref(null)
const inputRefs = new Map()
const placeholderRef = ref(null)

/**
 * @param {import('../model/outline.js').Tree} rows the rows to count
 * @return {number} how many rows there are, at every level
 */
function countRows(rows) {
	return rows.reduce((total, row) => total + 1 + countRows(row.children ?? []), 0)
}

const rowCount = computed(() => countRows(tree.value))
const isEmpty = computed(() => tree.value.length === 0)

/** Put the caret in the placeholder row, once it is on the page. */
function focusPlaceholder() {
	nextTick(() => placeholderRef.value?.focus())
}

onMounted(() => {
	if (isEmpty.value) {
		focusPlaceholder()
	}
})

// An undo that removes the only row brings the placeholder back with the caret in it.
watch(isEmpty, (empty) => {
	if (empty) {
		placeholderRef.value?.focus()
	}
}, { flush: 'post' })

/**
 * The first keystroke in the placeholder creates a real row through History,
 * so one undo removes it again. The new row's editor takes the focus.
 *
 * @param {InputEvent} event the input event
 */
function handlePlaceholderInput(event) {
	const text = event.target.value
	if (text === '') {
		return
	}
	event.target.value = ''
	const row = newRow(text)
	props.history.execute((rows) => [...rows, row], [])
	focus(row.id, 'end')
}

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
	const find = () => {
		const ref = inputRefs.get(rowId)
		if (ref && ref.isConnected) {
			return ref
		}
		return rootRef.value?.querySelector(`[data-row-id="${rowId}"] .outline-row__input, .outline-row__input[data-row-id="${rowId}"]`) || null
	}
	const apply = (el) => {
		el.focus()
		const pos = where === 'end' ? el.value.length : (typeof where === 'number' ? Math.min(where, el.value.length) : 0)
		el.setSelectionRange(pos, pos)
	}
	const el = find()
	if (el) {
		apply(el)
	}
	// A structural change (indent, outdent, move) re-renders the row under a new parent, so the
	// input focused above is replaced on the next render. Focus the row's new input once it exists.
	nextTick(() => {
		const current = find()
		if (current && document.activeElement !== current) {
			apply(current)
		}
	})
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
			caret: selStart,
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

/**
 *
 */
function noop() {}

provide('outlineEditor', {
	readonly: props.readonly,
	onInput: props.readonly ? noop : handleInput,
	toggleCollapsed,
	onKeydown: props.readonly ? noop : handleKeydown,
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
		:class="{ 'outline-editor--readonly': readonly }"
		role="tree">
		<div class="outline-column">
			<div role="tree">
				<OutlineRow
					v-for="row in tree"
					:key="row.id"
					:row="row">
					<template v-for="(_, name) in $slots" #[name]="slotProps">
						<slot :name="name" v-bind="slotProps" />
					</template>
				</OutlineRow>
				<div
					v-if="isEmpty && !readonly"
					class="outline-row level-1 outline-placeholder"
					role="treeitem">
					<div class="outline-row__line">
						<span class="outline-placeholder__gutter" aria-hidden="true" />
						<span class="outline-row__bullet" aria-hidden="true">•</span>
						<input
							ref="placeholderRef"
							type="text"
							class="outline-placeholder__input"
							placeholder="Type your first heading"
							aria-label="Type your first heading"
							@input="handlePlaceholderInput">
					</div>
				</div>
			</div>
			<KeyboardHints v-if="!readonly" :rowCount="rowCount" />
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
	min-width: 0;
	container: outline-editor / inline-size;
	display: flex;
	flex-direction: column;
	flex: 1;
	min-height: 0;
	overflow: auto;
}

.outline-column {
	box-sizing: border-box;
	width: 100%;
	max-width: 820px;
	margin: 0 auto;
	padding: 6px 44px 28px;
}

@container outline-editor (max-width: 759px) {
	.outline-column {
		padding-inline: 24px;
	}
}

@container outline-editor (max-width: 599px) {
	.outline-column {
		padding-inline: 8px;
	}

	.outline-placeholder__input {
		font-size: 18px;
	}
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

.outline-placeholder {
	margin-top: 14px;
}

.outline-placeholder .outline-row__line {
	background-color: var(--band-1);
	padding: 5px 4px 5px 0;
	min-height: 30px;
}

.outline-placeholder__gutter {
	width: 16px;
	min-width: 16px;
}

.outline-placeholder__input {
	flex: 1;
	min-width: 0;
	background: transparent;
	color: var(--color-main-text);
	border: 1px solid transparent;
	border-radius: var(--border-radius-element, 3px);
	padding: 4px 8px;
	font: inherit;
	font-size: 19px;
	font-weight: 650;
	letter-spacing: -0.005em;
	line-height: 1.5;
	outline: none;
}

.outline-placeholder__input::placeholder {
	color: var(--color-text-maxcontrast);
	font-weight: 400;
}

.outline-placeholder__input:focus {
	border-color: var(--color-primary-element, var(--color-border));
}
</style>
