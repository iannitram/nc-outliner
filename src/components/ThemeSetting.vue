<script setup>
import { ref, watch } from 'vue'
import { setSettings } from '../api/outlines.js'

const props = defineProps({
	modelValue: { type: String, default: 'auto' },
	disabled: { type: Boolean, default: false },
	save: { type: Function, default: setSettings },
})

const emit = defineEmits(['update:modelValue', 'error'])

const selected = ref(props.modelValue)
const saving = ref(false)
const errorMessage = ref('')

watch(() => props.modelValue, (val) => {
	selected.value = val
})

/**
 * @param {Event} event change event on select
 */
async function onSelectChange(event) {
	const nextTheme = event.target.value
	const previousTheme = props.modelValue
	saving.value = true
	errorMessage.value = ''
	try {
		const result = await props.save(nextTheme)
		const savedTheme = result?.theme ?? nextTheme
		selected.value = savedTheme
		emit('update:modelValue', savedTheme)
	} catch (error) {
		selected.value = previousTheme
		event.target.value = previousTheme
		errorMessage.value = 'Could not save the theme setting.'
		emit('error', error)
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<div class="theme-setting-container">
		<label class="theme-setting">
			<span>Theme</span>
			<select
				:value="selected"
				:disabled="disabled || saving"
				aria-label="Theme"
				@change="onSelectChange">
				<option value="auto">Auto</option>
				<option value="light">Light</option>
				<option value="dark">Dark</option>
			</select>
		</label>
		<p v-if="errorMessage" role="alert" class="theme-setting__error">
			{{ errorMessage }}
		</p>
	</div>
</template>

<style scoped>
.theme-setting-container {
	display: flex;
	flex-direction: column;
	gap: 0.25rem;
}

.theme-setting {
	display: flex;
	align-items: center;
	justify-content: space-between;
	gap: 0.5rem;
	color: var(--color-main-text);
}

select {
	color: var(--color-main-text);
	background: var(--color-main-background);
	border: 1px solid var(--color-border);
	border-radius: var(--border-radius-element);
	padding: 0.35rem;
}

.theme-setting__error {
	color: var(--color-error, var(--color-text-maxcontrast));
	margin: 0;
	font-size: 0.85rem;
}
</style>
