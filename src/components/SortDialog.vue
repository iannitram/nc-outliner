<script setup>
import { NcButton, NcDialog } from '@nextcloud/vue'
import { ref } from 'vue'

defineProps({
	open: {
		type: Boolean,
		required: true,
	},
})

const emit = defineEmits(['close', 'sort'])

const by = ref('text')
const direction = ref('asc')

const sortByOptions = [
	{ value: 'text', label: 'Row text' },
	{ value: 'note', label: 'Note' },
	{ value: 'status', label: 'Checkbox (from imported files)' },
]

const orderOptions = [
	{ value: 'asc', label: 'A → Z' },
	{ value: 'desc', label: 'Z → A' },
]

/**
 * @param {boolean} isOpen whether the dialog wants to be open
 */
function onUpdateOpen(isOpen) {
	if (!isOpen) {
		emit('close')
	}
}

/** Hand the choice to the view, which sorts through History. */
function apply() {
	emit('sort', { by: by.value, direction: direction.value })
}
</script>

<template>
	<NcDialog
		v-if="open"
		:open="open"
		container="#nc-outliner-dialogs"
		name="Sort rows"
		size="small"
		@update:open="onUpdateOpen">
		<fieldset class="sort-dialog__group">
			<legend class="sort-dialog__label">
				Sort by
			</legend>
			<label
				v-for="option in sortByOptions"
				:key="option.value"
				class="sort-dialog__radio">
				<input
					v-model="by"
					type="radio"
					name="sort-by"
					:value="option.value">
				<span>{{ option.label }}</span>
			</label>
		</fieldset>
		<fieldset class="sort-dialog__order">
			<legend class="sort-dialog__label">
				Order
			</legend>
			<span class="sort-dialog__seg">
				<label
					v-for="option in orderOptions"
					:key="option.value"
					class="sort-dialog__seg-option"
					:class="{ 'sort-dialog__seg-option--on': direction === option.value }">
					<input
						v-model="direction"
						type="radio"
						name="sort-order"
						class="sort-dialog__seg-input"
						:value="option.value">
					<span>{{ option.label }}</span>
				</label>
			</span>
		</fieldset>
		<p class="sort-dialog__note">
			Sorts the rows under every heading, at every level. Undo with Ctrl+Z.
		</p>
		<template #actions>
			<NcButton variant="tertiary" @click="emit('close')">
				Cancel
			</NcButton>
			<NcButton variant="primary" @click="apply">
				Sort
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.sort-dialog__group,
.sort-dialog__order {
	border: 0;
	margin: 0;
	padding: 0;
}

.sort-dialog__label {
	padding: 0;
	font-size: 13.5px;
	font-weight: 600;
	margin-bottom: 2px;
}

.sort-dialog__radio {
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 36px;
	font-size: 14.5px;
	cursor: pointer;
}

.sort-dialog__radio input {
	margin: 0;
	accent-color: var(--color-primary-element);
}

.sort-dialog__order {
	display: flex;
	align-items: center;
	gap: 12px;
	margin: 10px 0 12px;
}

.sort-dialog__order .sort-dialog__label {
	margin-bottom: 0;
	float: left;
}

.sort-dialog__seg {
	display: inline-flex;
	gap: 2px;
	padding: 3px;
	border-radius: var(--border-radius-element, 8px);
	background: var(--color-background-hover);
}

.sort-dialog__seg-option {
	position: relative;
	padding: 6px 14px;
	border-radius: 6px;
	font-size: 14px;
	font-weight: 600;
	color: var(--color-text-maxcontrast);
	cursor: pointer;
}

.sort-dialog__seg-option--on {
	background: var(--color-main-background);
	color: var(--color-main-text);
	box-shadow: 0 1px 2px var(--color-box-shadow);
}

.sort-dialog__seg-option:focus-within {
	outline: 2px solid var(--color-primary-element);
}

.sort-dialog__seg-input {
	position: absolute;
	opacity: 0;
	inset: 0;
	margin: 0;
	cursor: pointer;
}

.sort-dialog__note {
	margin: 0;
	font-size: 13.5px;
	color: var(--color-text-maxcontrast);
}
</style>
