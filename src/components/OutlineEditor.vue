<script setup>
import { computed, nextTick, onUnmounted, provide, ref, watch } from 'vue'
import ColumnsBar from './ColumnsBar.vue'
import OutlineRow from './OutlineRow.vue'
import * as keymap from '../editor/keymap.js'
import { sortRowsByColumn } from '../model/columns.js'
import { updateRow } from '../model/outline.js'

const props = defineProps({
	history: {
		type: Object,
		required: true,
	},
	columns: { type: Array, default: () => [] },
})

const emit = defineEmits(['outlineChange'])

const rootRef = ref(null)
const tree = ref(props.history.current())
const activeRowId = ref(null)
const caretPos = ref(0)
const inputRefs = new Map()
const keepSorted = ref(false)
const sortState = ref(null)
const visibleTree = computed(() => {
	if (!keepSorted.value || !sortState.value) {
		return tree.value
	}
	const column = props.columns.find((item) => item.id === sortState.value.id)
	return column ? sortRowsByColumn(tree.value, column, sortState.value.direction) : tree.value
})

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

provide('outlineEditor', {
	onInput: handleInput,
	onKeydown: handleKeydown,
	onFocus: handleFocus,
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
	columns: () => props.columns.filter((column) => !column.hidden),
	setColumnValue: (row, columnId, value) => props.history.execute(updateRow, [row.id, { values: { ...(row.values ?? {}), [columnId]: value } }]),
})

/**
 *
 * @param {import('../model/outline.js').Tree} rows sorted rows to record
 */
function sortPermanently(rows) {
	props.history.execute(() => rows, [])
}

/**
 *
 * @param {import('../model/outline.js').Tree} rows sorted rows
 * @param {{id: string, direction: string}} state active sort column and direction
 */
function handleSort(rows, state) {
	sortState.value = state
	if (!keepSorted.value) {
		sortPermanently(rows)
	}
}

defineExpose({
	focus,
})
</script>

<template>
	<div
		ref="rootRef"
		class="outline-editor"
		role="tree">
		<ColumnsBar
			:outline="{ columns, rows: tree }"
			:keepSorted="keepSorted"
			@update:outline="emit('outlineChange', $event)"
			@sort="handleSort"
			@update:keepSorted="keepSorted = $event" />
		<OutlineRow
			v-for="row in visibleTree"
			:key="row.id"
			:row="row">
			<template v-for="(_, name) in $slots" #[name]="slotProps">
				<slot :name="name" v-bind="slotProps" />
			</template>
		</OutlineRow>
	</div>
</template>

<style scoped>
.outline-editor {
	background-color: var(--color-main-background);
	color: var(--color-main-text);
	width: 100%;
	display: flex;
	flex-direction: column;
}
</style>
