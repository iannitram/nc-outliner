<script setup>
defineProps({
	modelValue: { type: String, default: 'auto' },
})

const emit = defineEmits(['update:modelValue'])
</script>

<template>
	<label class="theme-setting">
		<span>Theme</span>
		<select
			:value="modelValue"
			aria-label="Theme"
			@change="emit('update:modelValue', $event.target.value)">
			<option value="auto">Auto</option>
			<option value="light">Light</option>
			<option value="dark">Dark</option>
		</select>
	</label>
</template>

<style scoped>
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
</style>
