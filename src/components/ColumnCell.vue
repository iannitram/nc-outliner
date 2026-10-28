<script setup>
defineProps({
	column: { type: Object, required: true },
	value: { type: [Boolean, String, Number], default: '' },
})
const emit = defineEmits(['update:value'])

/**
 *
 * @param {unknown} value the edited cell value
 */
function set(value) {
	emit('update:value', value)
}
</script>

<template>
	<div class="column-cell" :style="{ width: `${column.width}px` }">
		<input
			v-if="column.type === 'checkbox'"
			type="checkbox"
			:checked="Boolean(value)"
			:aria-label="column.name"
			@change="set($event.target.checked)">
		<input
			v-else-if="['number', 'percent', 'currency', 'duration'].includes(column.type)"
			type="number"
			:step="column.type === 'duration' ? 1 : 'any'"
			:value="value"
			:aria-label="column.name"
			@change="set($event.target.value === '' ? null : Number($event.target.value))">
		<input
			v-else-if="column.type === 'date'"
			type="date"
			:value="value"
			:aria-label="column.name"
			@change="set($event.target.value)">
		<select
			v-else-if="column.type === 'popup'"
			:value="value"
			:aria-label="column.name"
			@change="set($event.target.value)">
			<option value="">
				Choose…
			</option><option v-for="option in column.options || []" :key="option" :value="option">
				{{ option }}
			</option>
		</select>
		<textarea
			v-else
			:value="value"
			:aria-label="column.name"
			@change="set($event.target.value)" />
	</div>
</template>

<style scoped>
.column-cell { box-sizing: border-box; flex: 0 0 auto; }
.column-cell input, .column-cell textarea, .column-cell select { box-sizing: border-box; width: 100%; }
.column-cell textarea { min-height: 2rem; resize: vertical; }
</style>
