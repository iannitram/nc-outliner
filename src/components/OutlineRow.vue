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
})

const emit = defineEmits(['input-text', 'row-keydown', 'row-focus'])

const inputRef = ref(null)
const noteRef = ref(null)
const addingNote = ref(false)
const instance = getCurrentInstance()
const editor = inject('outlineEditor', null)

const noteShown = computed(() => !props.row.noteHidden && (addingNote.value || props.row.note !== ''))
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
		<div class="outline-row__line">
			<slot name="handle" :row="row" />
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
		<div class="outline-row__note-area">
			<button
				type="button"
				class="outline-row__note-toggle"
				:aria-expanded="noteShown"
				@click="toggleNote">
				{{ noteToggleLabel }}
			</button>
			<textarea
				v-if="noteShown"
				ref="noteRef"
				class="outline-row__note"
				:data-note-id="row.id"
				:value="row.note"
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

.outline-row__note-area {
	display: flex;
	flex-direction: column;
	align-items: flex-start;
	gap: 4px;
	padding-left: 28px;
}

.outline-row__note-toggle {
	background: transparent;
	border: none;
	color: var(--color-text-maxcontrast, var(--color-main-text));
	cursor: pointer;
	font: inherit;
	font-size: 0.85em;
	padding: 2px 4px;
}

.outline-row__note-toggle:hover {
	color: var(--color-main-text);
	text-decoration: underline;
}

.outline-row__note {
	box-sizing: border-box;
	width: 100%;
	background: transparent;
	color: var(--color-main-text);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-element, 3px);
	padding: 6px 8px;
	font: inherit;
	line-height: 1.5;
	resize: vertical;
	outline: none;
}

.outline-row__note:focus {
	border-color: var(--color-primary-element, var(--color-border));
}
</style>
