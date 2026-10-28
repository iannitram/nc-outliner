<script setup>
import { showSuccess } from '@nextcloud/dialogs'
import { NcButton, NcIconSvgWrapper } from '@nextcloud/vue'
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import ConflictDialog from '../components/ConflictDialog.vue'
import OutlineEditor from '../components/OutlineEditor.vue'
import OutlineTopBar from '../components/OutlineTopBar.vue'
import SortDialog from '../components/SortDialog.vue'
import StatusLine from '../components/StatusLine.vue'
import { exportOpml, readOutline, saveCopy, saveOutline } from '../api/outlines.js'
import { createSaver } from '../editor/saver.js'
import { mdiEyeOutline } from '../icons.js'
import { createHistory } from '../model/history.js'
import { sortRows } from '../model/outline.js'
import { resetVersionsSidebar, versionsSidebar } from './versionsSidebarState.js'

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
// The older version shown read-only in place of the editor: { id, time, tree } (tree is null if unreadable).
const preview = ref(null)
const previewHistory = computed(() => (preview.value?.tree ? createHistory(preview.value.tree) : null))
const previewTime = computed(() => (preview.value
	? new Date(preview.value.time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
	: ''))
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

/** Close the versions sidebar; the main area goes back to the current outline. */
function closeVersions() {
	versionsOpen.value = false
	preview.value = null
}

/** The clock button: open the versions sidebar, or close it. */
function toggleVersions() {
	if (versionsOpen.value) {
		closeVersions()
	} else {
		versionsOpen.value = true
	}
}

/**
 * Show a version read-only in the main area, or the current outline again for null.
 *
 * @param {{id: string, time: number, tree: object[]|null}|null} version the picked version
 */
function showVersion(version) {
	preview.value = version
}

/** Restore the previewed version through the sidebar, which saves first and keeps the old state. */
async function restorePreview() {
	if (preview.value) {
		await versionsSidebar.restore?.(preview.value.id)
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
	Object.assign(versionsSidebar, {
		active: true,
		flush: flushBeforeRestore,
		reload: reloadAfterRestore,
		onPreview: showVersion,
		onRestored: () => showVersion(null),
		onClose: closeVersions,
	})
	load()
	window.addEventListener('pagehide', flushWhenLeaving)
	window.addEventListener('beforeunload', warnIfUnsaved)
	globalThis.document.addEventListener('visibilitychange', onVisibilityChange)
})
onUnmounted(() => {
	resetVersionsSidebar()
	loadGeneration++
	window.removeEventListener('pagehide', flushWhenLeaving)
	window.removeEventListener('beforeunload', warnIfUnsaved)
	globalThis.document.removeEventListener('visibilitychange', onVisibilityChange)
	unsubscribe?.()
	void saver?.flush().finally(() => saver?.destroy())
})
watch([() => props.fileId, title, versionsOpen, () => preview.value?.id ?? null], ([fileId, outlineTitle, open, selectedId]) => {
	Object.assign(versionsSidebar, { fileId, title: outlineTitle, open, selectedId })
}, { immediate: true })
watch(() => props.fileId, () => {
	sortOpen.value = false
	closeVersions()
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
				@openVersions="toggleVersions"
				@openSort="sortOpen = true" />
			<template v-if="preview">
				<div class="version-banner" role="status">
					<NcIconSvgWrapper class="version-banner__icon" :path="mdiEyeOutline" :size="20" />
					<div class="version-banner__text">
						<b>Version from {{ previewTime }}</b>
						<span>Read-only. Your current outline is unchanged.</span>
					</div>
					<NcButton v-if="preview.tree" variant="primary" @click="restorePreview">
						Restore this version
					</NcButton>
					<NcButton variant="tertiary" @click="showVersion(null)">
						Back to current
					</NcButton>
				</div>
				<OutlineEditor
					v-if="previewHistory"
					:key="preview.id"
					:history="previewHistory"
					class="outline-editor"
					readonly />
				<p v-else class="version-unreadable" role="status">
					This version can't be opened
				</p>
			</template>
			<OutlineEditor v-else-if="history" :history="history" class="outline-editor" />
			<SortDialog
				:open="sortOpen"
				@close="sortOpen = false"
				@sort="applySort" />
			<ConflictDialog
				:open="conflictOpen"
				:name="name"
				@reload="reloadAfterConflict"
				@keepCopy="keepCopy" />
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

.version-banner {
	flex: none;
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px 12px;
	margin: 6px 0 4px;
	padding: 10px 14px;
	border-radius: var(--border-radius-large, 10px);
	background: var(--color-primary-element-light);
	color: var(--color-primary-element-light-text);
}
.version-banner__text { flex: 1 1 240px; display: flex; flex-direction: column; }
.version-unreadable { flex: none; color: var(--color-error-text); padding: 12px 4px; }
</style>
