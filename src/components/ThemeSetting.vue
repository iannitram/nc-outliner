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
 * @param {Event} event change event on a theme radio
 */
async function onThemeChange(event) {
	if (props.disabled || saving.value) {
		return
	}
	const nextTheme = event.target.value
	const previousTheme = props.modelValue
	selected.value = nextTheme
	saving.value = true
	errorMessage.value = ''
	try {
		const result = await props.save(nextTheme)
		const savedTheme = result?.theme ?? nextTheme
		selected.value = savedTheme
		emit('update:modelValue', savedTheme)
	} catch (error) {
		selected.value = previousTheme
		errorMessage.value = 'Could not save the theme setting.'
		emit('error', error)
	} finally {
		saving.value = false
	}
}
</script>

<template>
	<div class="theme-setting-container">
		<fieldset class="theme-setting">
			<legend>Theme</legend>
			<label v-for="option in [{ value: 'auto', label: 'Follow Nextcloud' }, { value: 'light', label: 'Light' }, { value: 'dark', label: 'Dark' }]" :key="option.value">
				<input
					type="radio"
					name="outliner-theme"
					:value="option.value"
					:checked="selected === option.value"
					:disabled="disabled || saving"
					@change="onThemeChange">
				<span>{{ option.label }}</span>
			</label>
		</fieldset>
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
	border: 0;
	margin: 0;
	padding: 6px 12px 8px;
	color: var(--color-main-text);
}

.theme-setting legend {
	font-size: 13.5px;
	font-weight: 600;
	margin-bottom: 2px;
	padding: 0;
}

.theme-setting label {
	display: flex;
	align-items: center;
	gap: 10px;
	min-height: 36px;
	font-size: 14.5px;
	cursor: pointer;
}

.theme-setting input {
	margin: 0;
	accent-color: var(--color-primary-element);
}

.theme-setting__error {
	color: var(--color-error, var(--color-text-maxcontrast));
	margin: 0;
	font-size: 0.85rem;
}
</style>
