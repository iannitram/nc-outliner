<script setup>
import { NcButton, NcListItem } from '@nextcloud/vue'
import { onMounted, ref } from 'vue'
import { createOutline, listOutlines } from '../api/outlines.js'

const emit = defineEmits(['open'])
const entries = ref([])
const loading = ref(true)
const error = ref('')

/**
 *
 */
async function refresh() {
	loading.value = true
	error.value = ''
	try {
		entries.value = await listOutlines()
	} catch {
		error.value = 'Could not load your outlines.'
	} finally {
		loading.value = false
	}
}

/**
 *
 */
async function create() {
	try {
		const outline = await createOutline('')
		emit('open', outline.fileId)
	} catch {
		error.value = 'Could not create an outline.'
	}
}

onMounted(refresh)
</script>

<template>
	<section aria-label="My outlines">
		<div class="list-heading">
			<h2>My outlines</h2>
			<NcButton variant="primary" @click="create">
				New outline
			</NcButton>
		</div>
		<p v-if="loading" role="status">
			Loading outlines…
		</p>
		<p v-else-if="error" role="alert">
			{{ error }}
		</p>
		<p v-else-if="entries.length === 0">
			No outlines yet.
		</p>
		<ul v-else>
			<li v-for="entry in entries" :key="entry.fileId">
				<NcListItem :name="entry.name" :details="new Date(entry.mtime * 1000).toLocaleString()" @click="emit('open', entry.fileId)" />
			</li>
		</ul>
	</section>
</template>

<style scoped>
.list-heading { display: flex; align-items: center; justify-content: space-between; }
ul { list-style: none; padding: 0; }
</style>
