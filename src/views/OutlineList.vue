<script setup>
import { NcButton, NcEmptyContent } from '@nextcloud/vue'
import { ref } from 'vue'
import { createOutline } from '../api/outlines.js'

defineProps({
	error: {
		type: String,
		default: '',
	},
})

const emit = defineEmits(['open', 'create'])
const creating = ref(false)
const localError = ref('')

/**
 * Create a new outline when the empty-state button is clicked.
 */
async function create() {
	creating.value = true
	localError.value = ''
	try {
		const outline = await createOutline('')
		emit('create', outline.fileId)
		emit('open', outline.fileId)
	} catch {
		localError.value = 'Could not create an outline.'
	} finally {
		creating.value = false
	}
}
</script>

<template>
	<section class="outline-list-empty" aria-label="No outlines">
		<NcEmptyContent
			name="No outlines yet"
			description="Outlines are saved as .opml files in the Outlines folder of your Files, so they sync and keep versions like any other file.">
			<template #icon>
				<svg
					xmlns="http://www.w3.org/2000/svg"
					viewBox="0 0 16 16"
					class="empty-outline-icon"
					aria-hidden="true">
					<path d="M2 3h12v2H2V3Zm2 4h10v2H4V7Zm2 4h8v2H6v-2Z" fill="currentColor" />
				</svg>
			</template>
			<template #action>
				<div class="empty-actions">
					<NcButton variant="primary" :disabled="creating" @click="create">
						New outline
					</NcButton>
					<!-- "Import OPML..." is hidden until #27 merges -->
				</div>
			</template>
		</NcEmptyContent>
		<p v-if="error || localError" role="alert" class="outline-list-error">
			{{ error || localError }}
		</p>
	</section>
</template>

<style scoped>
.outline-list-empty {
	display: flex;
	flex-direction: column;
	align-items: center;
	justify-content: center;
	height: 100%;
	width: 100%;
}

.empty-outline-icon {
	width: 64px;
	height: 64px;
	color: var(--color-text-maxcontrast);
}

.empty-actions {
	display: flex;
	gap: 8px;
	align-items: center;
	justify-content: center;
}

.outline-list-error {
	color: var(--color-error, var(--color-text-maxcontrast));
	margin-top: 16px;
}
</style>
