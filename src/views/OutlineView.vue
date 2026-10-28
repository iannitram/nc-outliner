<script setup>
import { showSuccess } from '@nextcloud/dialogs'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ConflictDialog from '../components/ConflictDialog.vue'
import OutlineEditor from '../components/OutlineEditor.vue'
import PublishButton from '../components/PublishButton.vue'
import SaveStatus from '../components/SaveStatus.vue'
import { readOutline, saveCopy, saveOutline } from '../api/outlines.js'
import { createSaver } from '../editor/saver.js'
import { createHistory } from '../model/history.js'
import { newRow } from '../model/outline.js'

const props = defineProps({ fileId: { type: Number, required: true } })
const loading = ref(true)
const error = ref('')
const name = ref('')
const etag = ref('')
const document = ref(null)
const history = ref(null)
const title = computed(() => document.value?.title || name.value)
const saveStatus = ref('saved')
const conflictOpen = ref(false)
let saver = null
let unsubscribe = null
let currentDocument = null
let currentSession = null
let loadGeneration = 0

/**
 *
 * @param {{discardLocal?: boolean, fileId?: number}} options load behavior
 */
async function load({ discardLocal = false, fileId = props.fileId } = {}) {
	const requestedFileId = fileId
	const generation = ++loadGeneration
	loading.value = true
	error.value = ''
	try {
		if (!discardLocal) {
			await saver?.flush()
			if (saver?.isDirty()) {
				throw new Error('Unsaved outline changes')
			}
		}
		if (generation !== loadGeneration) {
			return
		}
		const result = await readOutline(requestedFileId)
		if (generation !== loadGeneration) {
			return
		}
		conflictOpen.value = false
		name.value = result.name
		etag.value = result.etag
		saveStatus.value = 'saved'
		document.value = result.outline
		currentDocument = result.outline
		unsubscribe?.()
		saver?.destroy()
		history.value = createHistory(result.outline.rows)
		const session = { fileId: requestedFileId, etag: result.etag }
		currentSession = session
		saver = createSaver({
			save: async (outline) => {
				const saved = await saveOutline(session.fileId, outline, session.etag)
				if (saved.ok) {
					session.etag = saved.etag
					if (session.fileId === props.fileId) {
						etag.value = saved.etag
					}
				}
				return saved
			},
			onStatus: (status) => { saveStatus.value = status },
			onConflict: () => { conflictOpen.value = true },
		})
		unsubscribe = history.value.subscribe((rows) => {
			currentDocument = { ...currentDocument, rows }
			document.value = currentDocument
			saver.schedule(currentDocument)
		})
	} catch {
		if (generation === loadGeneration) {
			error.value = saver?.isDirty() ? 'Your changes are still unsaved. Check your connection and try again.' : 'Could not open this outline.'
		}
	} finally {
		if (generation === loadGeneration) {
			loading.value = false
		}
	}
}

/**
 *
 */
function flushWhenLeaving() {
	void saver?.flush()
}

/**
 *
 * @param {BeforeUnloadEvent} event browser leave-warning event
 */
function warnIfUnsaved(event) {
	if (saver?.isDirty()) {
		event.preventDefault()
		event.returnValue = ''
	}
}

/**
 *
 */
async function reloadAfterConflict() {
	const session = currentSession
	if (session && session.fileId !== props.fileId) {
		window.location.hash = `#/outline/${session.fileId}`
	}
	await load({ discardLocal: true, fileId: session?.fileId ?? props.fileId })
}

/**
 *
 */
async function keepCopy() {
	try {
		const copy = await saveCopy(currentSession?.fileId ?? props.fileId, currentDocument)
		conflictOpen.value = false
		saver?.destroy()
		saver = null
		currentSession = null
		window.location.hash = `#/outline/${copy.fileId}`
		showSuccess(`Saved as ${copy.name}`)
	} catch {
		error.value = 'Could not save your changes as a copy.'
	}
}

/**
 *
 */
function onVisibilityChange() {
	if (globalThis.document.visibilityState === 'hidden') {
		flushWhenLeaving()
	}
}

/**
 * Save pending edits now. Resolves true only when nothing is left unsaved.
 *
 * @return {Promise<boolean>} true when the server has the latest outline
 */
async function flushPendingSave() {
	await saver?.flush()
	return !saver?.isDirty()
}

/**
 *
 */
async function beforeLeave() {
	return flushPendingSave()
}

/**
 * Update the publish path and trigger autosave.
 *
 * @param {string} newPath published document path
 */
function onPublished(newPath) {
	if (currentDocument) {
		currentDocument = { ...currentDocument, publishPath: newPath }
		document.value = currentDocument
		saver?.schedule(currentDocument)
	}
}

/** Create the first root row for a valid empty outline. */
function addFirstRow() {
	history.value?.execute((rows) => [...rows, newRow()], [])
}

defineExpose({ beforeLeave })

onMounted(() => {
	load()
	window.addEventListener('pagehide', flushWhenLeaving)
	window.addEventListener('beforeunload', warnIfUnsaved)
	globalThis.document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
	loadGeneration++
	window.removeEventListener('pagehide', flushWhenLeaving)
	window.removeEventListener('beforeunload', warnIfUnsaved)
	globalThis.document.removeEventListener('visibilitychange', onVisibilityChange)
	unsubscribe?.()
	void saver?.flush().finally(() => saver?.destroy())
})
watch(() => props.fileId, load)
</script>

<template>
	<section class="outline-view">
		<p v-if="loading && !history" role="status">
			Loading outline…
		</p>
		<p v-if="error" role="alert">
			{{ error }}
		</p>
		<template v-if="!loading && history">
			<div class="outline-header">
				<h2>{{ title }}</h2>
				<SaveStatus :status="saveStatus" />
				<PublishButton
					:fileId="props.fileId"
					:publishPath="document?.publishPath ?? null"
					:name="name"
					:title="title"
					:beforePublish="flushPendingSave"
					@published="onPublished" />
			</div>
			<button v-if="history.current().length === 0" type="button" @click="addFirstRow">
				Add first row
			</button>
			<OutlineEditor v-if="history" :history="history" />
		</template>
		<ConflictDialog
			:open="conflictOpen"
			:name="name"
			@reload="reloadAfterConflict"
			@keepCopy="keepCopy" />
	</section>
</template>

<style scoped>
.outline-view { width: 100%; }
.outline-header {
	display: flex;
	align-items: center;
	gap: 12px;
}
</style>
