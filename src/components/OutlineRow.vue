<script setup>
import { computed, getCurrentInstance, inject, nextTick, onUnmounted, ref, watch } from 'vue'
import { updateRow } from '../model/outline.js'

const props = defineProps({
	row: {
		type: Object,
		required: true,
	},
	history: {
		type: Object,
		default: null,
	},
	/** Nesting depth: 0 for top-level rows, 1 for their children, and so on. */
	depth: {
		type: Number,
		default: 0,
	},
})

const emit = defineEmits(['input-text', 'row-keydown', 'row-focus'])

const inputRef = ref(null)
const noteRef = ref(null)
const addingNote = ref(false)
const instance = getCurrentInstance()
const editor = inject('outlineEditor', null)

const hasChildren = computed(() => Boolean(props.row.children && props.row.children.length > 0))

/**
 * The level styling, by the heading rule in ADR 0003: depth 0 is `level-1`,
 * depth 1 with children is `level-2`, and everything else is `body`.
 */
const levelClass = computed(() => {
	if (props.depth === 0) {
		return 'level-1'
	}
	if (props.depth === 1 && hasChildren.value) {
		return 'level-2'
	}
	return 'body'
})

/**
 * @param {object} row the row to count under
 * @return {number} the number of rows nested under it, at any depth
 */
function countDescendants(row) {
	return (row.children ?? []).reduce((total, child) => total + 1 + countDescendants(child), 0)
}

/** The "N rows" label shown after a folded branch's title, or '' when not folded. */
const foldedLabel = computed(() => {
	if (!props.row.collapsed || !hasChildren.value) {
		return ''
	}
	const count = countDescendants(props.row)
	return `${count} ${count === 1 ? 'row' : 'rows'}`
})

const noteShown = computed(() => !props.row.noteHidden && (addingNote.value || props.row.note !== ''))
// A row whose note is hidden keeps its note toggle visible, so the note can be shown again.
const noteToggleAlwaysShown = computed(() => Boolean(props.row.noteHidden && props.row.note !== ''))
const noteToggleLabel = computed(() => {
	if (noteShown.value) {
		return 'Hide note'
	}
	return props.row.note ? 'Show note' : 'Add note'
})

/**
 * The History that owns this row's tree. The editor provides its context under
 * `outlineEditor`; tests may put the History there, otherwise walk up to the
 * component that declares the History prop.
 *
 * @return {object|null} the outline History, or null outside an editor
 */
function resolveHistory() {
	if (props.history) {
		return props.history
	}
	if (editor?.history) {
		return editor.history
	}
	let parent = instance?.parent
	while (parent) {
		if (parent.props?.history) {
			return parent.props.history
		}
		parent = parent.parent
	}
	return null
}

/**
 *
 * @param {object} patch the updateRow patch
 * @param {string} mergeKey the History merge key
 */
function applyNoteChange(patch, mergeKey) {
	const history = resolveHistory()
	if (!history) {
		return
	}
	history.execute(updateRow, [props.row.id, patch], { mergeKey })
}

/**
 *
 * @param {InputEvent} event the note input event
 */
function handleNoteInput(event) {
	addingNote.value = true
	applyNoteChange({ note: event.target.value }, `note:${props.row.id}`)
}

/** Show or hide this row's note. */
function toggleNote() {
	if (noteShown.value) {
		addingNote.value = false
		applyNoteChange({ noteHidden: true }, `noteHidden:${props.row.id}`)
		return
	}
	addingNote.value = true
	if (props.row.noteHidden) {
		applyNoteChange({ noteHidden: false }, `noteHidden:${props.row.id}`)
	}
	nextTick(() => noteRef.value?.focus())
}

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
		:class="levelClass"
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
				:class="{ 'outline-row__input--folded': foldedLabel }"
				:style="foldedLabel ? { '--title-ch': Math.max(row.text.length, 1) } : undefined"
				:data-row-id="row.id"
				:value="row.text"
				:aria-label="row.text || 'Row text'"
				@input="handleInput"
				@keydown="handleKeydown"
				@focus="handleFocus">
			<span v-if="foldedLabel" class="outline-row__more">{{ foldedLabel }}</span>
			<button
				type="button"
				class="outline-row__note-toggle"
				:class="{ 'outline-row__note-toggle--always': noteToggleAlwaysShown }"
				:aria-expanded="noteShown"
				:aria-label="noteToggleLabel"
				:title="noteToggleLabel"
				@click="toggleNote">
				<svg
					viewBox="0 0 24 24"
					width="16"
					height="16"
					aria-hidden="true">
					<path
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M5 4.5h14v11l-4.5 4.5H5z M14.5 20v-4.5H19 M8.5 9h7 M8.5 12.5h4" />
				</svg>
			</button>
		</div>
		<slot name="note" :row="row" />
		<div class="outline-row__note-area">
			<textarea
				v-if="noteShown"
				ref="noteRef"
				class="outline-row__note"
				:data-note-id="row.id"
				:value="row.note"
				rows="1"
				aria-label="Row note"
				@input="handleNoteInput" />
		</div>
		<div
			v-if="!row.collapsed && row.children && row.children.length > 0"
			class="outline-row__children"
			role="group">
			<OutlineRow
				v-for="child in row.children"
				:key="child.id"
				:row="child"
				:depth="depth + 1">
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

.outline-row__line {
	padding-right: 4px;
}

.outline-row__line:hover {
	background-color: var(--color-background-hover);
}

.outline-row__input {
	flex: 1;
	min-width: 0;
	background: transparent;
	color: var(--color-main-text);
	border: 1px solid transparent;
	border-radius: var(--border-radius-element, 3px);
	padding: 4px 8px;
	font: inherit;
	font-size: 15px;
	line-height: 1.5;
	outline: none;
}

/* A folded row sizes its input to the title so the "N rows" label sits right after it. */
.outline-row__input--folded {
	flex: 0 1 auto;
	width: calc(var(--title-ch, 1) * 1ch + 20px);
	max-width: 100%;
}

@supports (field-sizing: content) {
	.outline-row__input--folded {
		field-sizing: content;
		width: auto;
	}
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
	/* Hidden until the row is hovered or has focus inside it, so keyboard users can still reach it. */
	opacity: 0;
	transition: opacity 0.15s;
}

.outline-row__line:hover .outline-row__handle,
.outline-row__line:focus-within .outline-row__handle {
	opacity: 0.6;
}

.outline-row__handle:hover,
.outline-row__handle:focus-visible {
	opacity: 1;
}

/* Level styling (ADR 0003): the level class sits on the row, the band on its line. */
.outline-row.level-1 > .outline-row__line {
	margin-top: 18px;
	padding-top: 5px;
	padding-bottom: 5px;
	min-height: 30px;
	background-color: var(--band-1);
}

.outline-row.level-1:first-child > .outline-row__line {
	margin-top: 4px;
}

.outline-row.level-1 > .outline-row__line:hover {
	background-color: color-mix(in srgb, var(--band-1) 70%, var(--color-background-dark));
}

.outline-row.level-1 > .outline-row__line .outline-row__input {
	font-size: 19px;
	font-weight: 650;
	letter-spacing: -0.005em;
}

.outline-row.level-2 > .outline-row__line {
	margin-top: 8px;
	padding-top: 4px;
	padding-bottom: 4px;
	min-height: 26px;
	background-color: var(--band-2);
}

.outline-row.level-2 > .outline-row__line .outline-row__input {
	font-size: 16px;
	font-weight: 600;
}

.outline-row__more {
	flex: none;
	margin-left: 8px;
	margin-right: 4px;
	font-size: 12.5px;
	font-weight: 500;
	color: var(--color-text-maxcontrast, var(--color-main-text));
	white-space: nowrap;
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
}

.outline-row__children {
	margin-left: 24px;
}

.outline-row__note-area {
	display: flex;
	flex-direction: column;
	align-items: stretch;
	/* Handle 16 + gap 4 + gutter 24 + gap 4: the note's text lines up with the row text. */
	padding-left: 48px;
	padding-right: 12px;
}

.outline-row__note-toggle {
	flex: none;
	margin-left: auto;
	display: flex;
	align-items: center;
	justify-content: center;
	width: 24px;
	height: 24px;
	padding: 0;
	background: transparent;
	border: none;
	border-radius: var(--border-radius-element, 3px);
	color: var(--color-text-maxcontrast, var(--color-main-text));
	cursor: pointer;
	/* Shown on hover or focus inside the row, or always while a note is hidden. Still focusable when hidden. */
	opacity: 0;
	pointer-events: none;
	transition: opacity 0.15s;
}

.outline-row__line:hover .outline-row__note-toggle,
.outline-row__line:focus-within .outline-row__note-toggle,
.outline-row__note-toggle:focus-visible,
.outline-row__note-toggle--always {
	opacity: 1;
	pointer-events: auto;
}

.outline-row__note-toggle:hover {
	color: var(--color-main-text);
}

/* A note is muted text under its row; it only gets a border while it has focus. */
.outline-row__note {
	box-sizing: border-box;
	width: 100%;
	background: transparent;
	color: var(--color-text-maxcontrast, var(--color-main-text));
	border: 1px solid transparent;
	border-radius: var(--border-radius-element, 3px);
	padding: 0 8px 6px;
	font: inherit;
	font-size: 13.5px;
	line-height: 1.5;
	resize: none;
	overflow: hidden;
	outline: none;
}

@supports (field-sizing: content) {
	.outline-row__note {
		field-sizing: content;
	}
}

.outline-row__note:focus {
	border-color: var(--color-primary-element, var(--color-border));
	color: var(--color-main-text);
}
</style>
