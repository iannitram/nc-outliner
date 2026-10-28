<script setup>
import { NcButton } from '@nextcloud/vue'
import { ref } from 'vue'
import { addColumn, removeColumn, sortRowsByColumn, updateColumn } from '../model/columns.js'

const props = defineProps({
	outline: { type: Object, required: true },
	keepSorted: { type: Boolean, default: false },
})
const emit = defineEmits(['update:outline', 'sort', 'update:keepSorted'])
const name = ref('')
const type = ref('richtext')
const sortId = ref('')
const direction = ref('asc')
const types = [
	{ id: 'richtext', label: 'Text' },
	{ id: 'checkbox', label: 'Checkbox' },
	{ id: 'number', label: 'Number' },
	{ id: 'percent', label: 'Percent' },
	{ id: 'currency', label: 'Currency' },
	{ id: 'date', label: 'Date' },
	{ id: 'duration', label: 'Duration' },
	{ id: 'popup', label: 'Pop-up list' },
]

/**
 *
 */
function add() {
	const next = addColumn(props.outline, name.value, type.value)
	name.value = ''
	emit('update:outline', next)
}
/**
 *
 * @param {object} column the column to update
 * @param {object} values the column fields to change
 */
function patch(column, values) {
	emit('update:outline', updateColumn(props.outline, column.id, values))
}
/**
 *
 * @param {object} column the column to remove
 */
function remove(column) {
	emit('update:outline', removeColumn(props.outline, column.id))
}
/**
 *
 */
function sort() {
	const column = props.outline.columns.find((item) => item.id === sortId.value)
	if (!column) {
		return
	}
	emit('sort', sortRowsByColumn(props.outline.rows, column, direction.value), { id: column.id, direction: direction.value })
}
</script>

<template>
	<section class="columns-bar" aria-label="Outline columns">
		<form class="column-add" @submit.prevent="add">
			<input v-model="name" aria-label="New column name" placeholder="Column name">
			<select v-model="type" aria-label="New column type">
				<option v-for="option in types" :key="option.id" :value="option.id">
					{{ option.label }}
				</option>
			</select>
			<NcButton type="submit" :disabled="!name.trim()">
				Add column
			</NcButton>
		</form>
		<div v-if="outline.columns?.length" class="column-headers" role="row">
			<div
				v-for="column in outline.columns"
				:key="column.id"
				class="column-header"
				:style="{ width: `${column.width}px` }">
				<input :value="column.name" :aria-label="`Rename ${column.name}`" @change="patch(column, { name: $event.target.value })">
				<select :value="column.type" :aria-label="`${column.name} type`" @change="patch(column, { type: $event.target.value })">
					<option v-for="option in types" :key="option.id" :value="option.id">
						{{ option.label }}
					</option>
				</select>
				<input
					v-if="column.type === 'popup'"
					:value="(column.options || []).join(', ')"
					:aria-label="`${column.name} options`"
					placeholder="Options, comma separated"
					@change="patch(column, { options: $event.target.value.split(',').map(option => option.trim()).filter(Boolean) })">
				<input
					type="range"
					min="48"
					max="600"
					:value="column.width"
					:aria-label="`${column.name} width`"
					@input="patch(column, { width: Number($event.target.value) })">
				<select :value="column.summary || 'none'" :aria-label="`${column.name} summary`" @change="patch(column, { summary: $event.target.value })">
					<option value="none">
						No summary
					</option><option value="sum">
						Total
					</option><option value="min">
						Min
					</option><option value="max">
						Max
					</option><option value="average">
						Average
					</option><option value="count">
						Checkbox state
					</option>
				</select>
				<label><input type="checkbox" :checked="column.hidden" @change="patch(column, { hidden: $event.target.checked })"> Hide</label>
				<NcButton @click="remove(column)">
					Remove
				</NcButton>
			</div>
		</div>
		<form v-if="outline.columns?.length" class="column-sort" @submit.prevent="sort">
			<label for="column-sort">Sort by</label>
			<select id="column-sort" v-model="sortId">
				<option value="">
					Choose column
				</option><option v-for="column in outline.columns" :key="column.id" :value="column.id">
					{{ column.name }}
				</option>
			</select>
			<select v-model="direction" aria-label="Sort direction">
				<option value="asc">
					Ascending
				</option><option value="desc">
					Descending
				</option>
			</select>
			<NcButton type="submit" :disabled="!sortId">
				Sort
			</NcButton>
			<label><input type="checkbox" :checked="keepSorted" @change="$emit('update:keepSorted', $event.target.checked)"> Keep sorted (display only)</label>
		</form>
	</section>
</template>

<style scoped>
.columns-bar { display: flex; flex-direction: column; gap: 0.5rem; color: var(--color-main-text); }
.column-add, .column-sort, .column-header { display: flex; align-items: center; gap: 0.5rem; }
.column-headers { display: flex; flex-wrap: wrap; gap: 0.5rem; }
.column-header { border: 1px solid var(--color-border); padding: 0.35rem; overflow-x: auto; }
.column-header input[type='range'] { width: 5rem; }
</style>
