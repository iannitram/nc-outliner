<script setup>
import { showSuccess } from '@nextcloud/dialogs'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ConflictDialog from '../components/ConflictDialog.vue'
import OutlineEditor from '../components/OutlineEditor.vue'
import OutlineTopBar from '../components/OutlineTopBar.vue'
import SortDialog from '../components/SortDialog.vue'
import StatusLine from '../components/StatusLine.vue'
import VersionsPanel from '../components/VersionsPanel.vue'
import { exportOpml, readOutline, saveCopy, saveOutline } from '../api/outlines.js'
import { createSaver } from '../editor/saver.js'
import { createHistory } from '../model/history.js'
import { sortRows } from '../model/outline.js'

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
const versionsOpen = ref(false)
const sortOpen = ref(false)
const publishedOpenUrl = ref('')
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
		publishedOpenUrl.value = ''
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
 * Save pending edits before a version is restored over the file.
 *
 * @return {Promise<boolean>} true when nothing unsaved is left
 */
async function flushBeforeRestore() {
	await saver?.flush()
	return !saver?.isDirty()
}

/**
 * Reload the outline and its etag after a restore, through the normal load path.
 */
async function reloadAfterRestore() {
	await load()
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
 * @param {string} openUrl URL to open the published document
 */
function onPublished(newPath, openUrl = '') {
	if (currentDocument) {
		publishedOpenUrl.value = openUrl
		currentDocument = { ...currentDocument, publishPath: newPath }
		document.value = currentDocument
		saver?.schedule(currentDocument)
	}
}

/**
 * Sort every level through History, so one undo reverses it.
 *
 * @param {{by: 'text'|'status'|'note', direction: 'asc'|'desc'}} choice the dialog's choice
 */
function applySort({ by, direction }) {
	history.value?.execute(sortRows, [by, direction])
	sortOpen.value = false
}

/** @return {Promise<object|null>} OPML including the current unsaved edits */
async function getWorkingFile() {
	if (loading.value || !currentDocument || currentSession?.fileId !== props.fileId) {
		return null
	}
	return { name: 'outline.opml', type: 'text/x-opml', data: await exportOpml(currentDocument) }
}

defineExpose({ beforeLeave, getWorkingFile })

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
watch(() => props.fileId, () => {
	sortOpen.value = false
	load()
})
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
			<OutlineTopBar
				:title="title"
				:fileId="props.fileId"
				:publishPath="document?.publishPath ?? null"
				:name="name"
				:beforePublish="flushPendingSave"
				@published="onPublished"
				@openVersions="versionsOpen = true"
				@openSort="sortOpen = true" />
			<OutlineEditor v-if="history" :history="history" class="outline-editor" />
			<SortDialog
				:open="sortOpen"
				@close="sortOpen = false"
				@sort="applySort" />
			<ConflictDialog
				:open="conflictOpen"
				:name="name"
				@reload="reloadAfterConflict"
				@keepCopy="keepCopy" />
			<VersionsPanel
				:fileId="props.fileId"
				:open="versionsOpen"
				:flush="flushBeforeRestore"
				:reload="reloadAfterRestore"
				@close="versionsOpen = false" />
			<StatusLine
				:status="saveStatus"
				:openUrl="publishedOpenUrl"
				:rows="document?.rows ?? []"
				:publishPath="document?.publishPath ?? null" />
		</template>
	</section>
</template>

<style scoped>
.outline-view {
	width: 100%;
	height: 100%;
	display: flex;
	flex-direction: column;
	overflow: hidden;
}

.outline-top-bar,
:deep(.outline-top-bar) {
	flex: none;
}

.outline-editor,
:deep(.outline-editor) {
	flex: 1;
	min-height: 0;
	overflow: auto;
}

.status-line,
:deep(.status-line) {
	flex: none;
}
</style>
