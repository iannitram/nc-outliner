<script setup>
import { inject, onUnmounted, ref, watch } from 'vue'

const props = defineProps({
	row: {
		type: Object,
		required: true,
	},
})

const emit = defineEmits(['input-text', 'row-keydown', 'row-focus'])

const inputRef = ref(null)
const editor = inject('outlineEditor', null)

/**
 *
 * @param {HTMLInputElement|null} el the row input element
 */
function onInputRef(el) {
	inputRef.value = el
	if (editor) {
		editor.registerInput(props.row.id, el)
	}
}

onUnmounted(() => {
	if (editor) {
		editor.unregisterInput(props.row.id)
	}
})

watch(
	() => props.row.id,
	(newId, oldId) => {
		if (editor) {
			if (oldId) {
				editor.unregisterInput(oldId)
			}
			if (newId && inputRef.value) {
				editor.registerInput(newId, inputRef.value)
			}
		}
	},
)

/**
 *
 * @param {InputEvent} event the input event
 */
function handleInput(event) {
	if (editor) {
		editor.onInput(props.row, event)
	}
	// eslint-disable-next-line vue/custom-event-name-casing
	emit('input-text', props.row.id, event.target.value, event)
}

/**
 *
 * @param {KeyboardEvent} event the keydown event
 */
function handleKeydown(event) {
	if (editor) {
		editor.onKeydown(props.row, event)
	}
	// eslint-disable-next-line vue/custom-event-name-casing
	emit('row-keydown', props.row.id, event)
}

/**
 *
 * @param {FocusEvent} event the focus event
 */
function handleFocus(event) {
	if (editor) {
		editor.onFocus(props.row, event)
	}
	// eslint-disable-next-line vue/custom-event-name-casing
	emit('row-focus', props.row.id, event)
}

/** Toggle this row's expanded state through the editor history. */
function toggleCollapsed() {
	if (editor && props.row.children && props.row.children.length > 0) {
		editor.toggleCollapsed(props.row)
	}
}

/**
 * @param {DragEvent} event the dragstart event
 */
function handleDragStart(event) {
	if (!editor) {
		return
	}
	if (event.dataTransfer) {
		event.dataTransfer.effectAllowed = 'move'
		event.dataTransfer.setData('text/plain', props.row.id)
	}
	editor.startDrag(props.row, event)
}

/**
 * @param {DragEvent} event the dragend event
 */
function handleDragEnd(event) {
	if (editor) {
		editor.endDrag(event)
	}
}

/**
 * @param {DragEvent} event the dragover event
 */
function handleDragOver(event) {
	if (!editor || !editor.isDragging()) {
		return
	}
	event.preventDefault()
	if (event.dataTransfer) {
		event.dataTransfer.dropEffect = 'move'
	}
	editor.dragOverRow(props.row, event)
}

/**
 * @param {DragEvent} event the drop event
 */
function handleDrop(event) {
	if (!editor || !editor.isDragging()) {
		return
	}
	event.preventDefault()
	editor.dropOnRow(props.row, event)
}

/**
 * @param {'before'|'after'|'nest'} position the drop position to test
 * @return {boolean} whether this row is the current drop target there
 */
function isDropTarget(position) {
	const target = editor?.dropTarget?.value
	return Boolean(target && target.rowId === props.row.id && target.position === position)
}

/**
 *
 * @param {number|'start'|'end'} where the caret position
 */
function focus(where = 'start') {
	if (inputRef.value) {
		inputRef.value.focus()
		const pos = where === 'end' ? inputRef.value.value.length : (typeof where === 'number' ? where : 0)
		inputRef.value.setSelectionRange(pos, pos)
	}
}

defineExpose({
	inputRef,
	focus,
})
</script>

<template>
	<div
		class="outline-row"
		:data-row-id="row.id"
		role="treeitem"
		:aria-expanded="row.children && row.children.length > 0 ? !row.collapsed : undefined">
		<div
			class="outline-row__line"
			:class="{
				'outline-row__line--drop-before': isDropTarget('before'),
				'outline-row__line--drop-after': isDropTarget('after'),
				'outline-row__line--drop-nest': isDropTarget('nest'),
			}"
			@dragover="handleDragOver"
			@drop="handleDrop">
			<slot name="handle" :row="row">
				<button
					type="button"
					class="outline-row__handle"
					aria-label="Drag row"
					draggable="true"
					@dragstart="handleDragStart"
					@dragend="handleDragEnd">
					<span aria-hidden="true">⠿</span>
				</button>
			</slot>
			<slot name="toggle" :row="row" :toggle="toggleCollapsed">
				<template v-if="row.children && row.children.length > 0">
					<slot name="triangle" :row="row" :toggle="toggleCollapsed">
						<button
							type="button"
							class="outline-row__disclosure"
							:aria-label="row.collapsed ? 'Expand row' : 'Collapse row'"
							:aria-expanded="!row.collapsed"
							@click="toggleCollapsed">
							{{ row.collapsed ? '▸' : '▾' }}
						</button>
					</slot>
				</template>
				<slot v-else name="bullet" :row="row">
					<span class="outline-row__bullet" aria-hidden="true">•</span>
				</slot>
			</slot>
			<input
				:ref="onInputRef"
				type="text"
				class="outline-row__input"
				:data-row-id="row.id"
				:value="row.text"
				:aria-label="row.text || 'Row text'"
				@input="handleInput"
				@keydown="handleKeydown"
				@focus="handleFocus">
		</div>
		<slot name="note" :row="row" />
		<div
			v-if="!row.collapsed && row.children && row.children.length > 0"
			class="outline-row__children"
			role="group">
			<OutlineRow
				v-for="child in row.children"
				:key="child.id"
				:row="child">
				<template v-for="(_, name) in $slots" #[name]="slotProps">
					<slot :name="name" v-bind="slotProps" />
				</template>
			</OutlineRow>
		</div>
	</div>
</template>

<style scoped>
.outline-row {
	display: flex;
	flex-direction: column;
	width: 100%;
}

.outline-row__line {
	display: flex;
	align-items: center;
	min-height: 32px;
	gap: 4px;
}

.outline-row__input {
	flex: 1;
	background: transparent;
	color: var(--color-main-text);
	border: 1px solid transparent;
	border-radius: var(--border-radius-element, 3px);
	padding: 4px 8px;
	font: inherit;
	line-height: 1.5;
	outline: none;
}

.outline-row__handle {
	width: 16px;
	min-width: 16px;
	height: 24px;
	padding: 0;
	border: 0;
	background: transparent;
	color: var(--color-text-maxcontrast, var(--color-main-text));
	cursor: grab;
	opacity: 0.6;
}

.outline-row__handle:hover,
.outline-row__handle:focus-visible {
	opacity: 1;
}

.outline-row__handle:active {
	cursor: grabbing;
}

.outline-row__line--drop-before {
	box-shadow: inset 0 2px 0 var(--color-primary-element, var(--color-border));
}

.outline-row__line--drop-after {
	box-shadow: inset 0 -2px 0 var(--color-primary-element, var(--color-border));
}

.outline-row__line--drop-nest {
	background-color: var(--color-primary-light, var(--color-background-hover));
}

.outline-row__disclosure {
	width: 24px;
	min-width: 24px;
	height: 24px;
	padding: 0;
	border: 0;
	background: transparent;
	color: inherit;
	cursor: pointer;
}

.outline-row__bullet {
	width: 24px;
	min-width: 24px;
	text-align: center;
}

.outline-row__input:focus {
	border-color: var(--color-primary-element, var(--color-border));
	background-color: var(--color-main-background);
}

.outline-row__children {
	margin-left: 24px;
}
</style>
