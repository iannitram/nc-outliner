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
			<slot name="toggle" :row="row">
				<slot name="triangle" :row="row">
					<slot name="bullet" :row="row" />
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

.outline-row__input:focus {
	border-color: var(--color-primary-element, var(--color-border));
	background-color: var(--color-main-background);
}

.outline-row__children {
	margin-left: 24px;
}
</style>
