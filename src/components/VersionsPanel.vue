<script setup>
import { NcButton, NcDialog, NcTextField } from '@nextcloud/vue'
import { ref, watch } from 'vue'
import { listVersions, nameVersion, readVersion, restoreVersion } from '../api/versions.js'

/**
 * The outline's versions (ADR 0004). Read-only preview, restore, and naming, through the WebDAV
 * client. The view supplies `flush` (saves pending edits; resolves false if something is still
 * unsaved) and `reload` (reloads the outline and its etag through the view's own load path).
 */
const props = defineProps({
	fileId: { type: Number, required: true },
	open: { type: Boolean, required: true },
	flush: { type: Function, required: true },
	reload: { type: Function, required: true },
})
const emit = defineEmits(['close'])

const versions = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const preview = ref(null)
const renaming = ref(null)
const offer = ref(null)

/**
 * Format a version time for people to read.
 *
 * @param {number} time milliseconds since 1970
 * @return {string} local date and time
 */
function formatTime(time) {
	return new Date(time).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}

/**
 * Fetch the newest-first list. A failure keeps the old list and shows a message.
 */
async function loadList() {
	try {
		versions.value = await listVersions(props.fileId)
	} catch {
		error.value = 'Could not load versions.'
	}
}

watch(() => props.open, async (isOpen) => {
	if (!isOpen) {
		return
	}
	error.value = ''
	preview.value = null
	renaming.value = null
	loading.value = true
	await loadList()
	loading.value = false
}, { immediate: true })

/**
 * Show one older version's text, read-only.
 *
 * @param {string} id version id
 */
async function showPreview(id) {
	error.value = ''
	try {
		preview.value = { id, text: await readVersion(props.fileId, id) }
	} catch {
		error.value = 'Could not preview this version.'
	}
}

/**
 * Save pending edits, restore one older version, reload the outline, and offer to name the
 * state from before the restore (now the new top entry).
 *
 * @param {string} id version id to restore
 */
async function restore(id) {
	error.value = ''
	busy.value = true
	try {
		if (!await props.flush()) {
			error.value = 'Some changes are not saved yet, so nothing was restored. Try again once the outline is saved.'
			return
		}
		await restoreVersion(props.fileId, id)
	} catch {
		error.value = 'Could not restore this version.'
		return
	} finally {
		busy.value = false
	}
	preview.value = null
	renaming.value = null
	await props.reload()
	await loadList()
	const [newest] = versions.value
	if (newest) {
		offer.value = { id: newest.id, label: `Before restore ${formatTime(newest.time)}` }
	}
}

/**
 * Name one version so that it is kept; an empty name removes the name.
 *
 * @param {string} id version id
 * @param {string} label the name
 */
async function saveName(id, label) {
	error.value = ''
	busy.value = true
	try {
		await nameVersion(props.fileId, id, label.trim())
		renaming.value = null
		if (offer.value?.id === id) {
			offer.value = null
		}
		await loadList()
	} catch {
		error.value = 'Could not name this version.'
	} finally {
		busy.value = false
	}
}

/**
 * Open the inline name field for one version.
 *
 * @param {{id: string, label: string}} version the version to name
 */
function startRename(version) {
	renaming.value = { id: version.id, label: version.label }
}
</script>

<template>
	<NcDialog
		v-if="open"
		name="Versions"
		:container="null"
		size="large"
		@closing="emit('close')">
		<p v-if="loading" role="status">
			Loading versions…
		</p>
		<p v-if="error" role="alert">
			{{ error }}
		</p>
		<div v-if="offer" class="version-offer">
			<p>Keep the state from before this restore? A named version is never removed.</p>
			<NcTextField v-model="offer.label" label="Name for the state before the restore" />
			<NcButton variant="primary" :disabled="busy" @click="saveName(offer.id, offer.label)">
				Save name
			</NcButton>
			<NcButton :disabled="busy" @click="offer = null">
				Dismiss
			</NcButton>
		</div>
		<ol v-if="versions.length" class="version-list">
			<li v-for="(version, index) in versions" :key="version.id" class="version-row">
				<div class="version-info">
					<time :datetime="new Date(version.time).toISOString()">{{ formatTime(version.time) }}</time>
					<strong v-if="index === 0">Current</strong>
					<span v-if="version.label" class="version-name">{{ version.label }}</span>
				</div>
				<div v-if="index > 0" class="version-actions">
					<NcButton :disabled="busy" @click="showPreview(version.id)">
						Preview
					</NcButton>
					<NcButton :disabled="busy" @click="restore(version.id)">
						Restore
					</NcButton>
					<NcButton :disabled="busy" @click="startRename(version)">
						Name
					</NcButton>
				</div>
				<div v-if="renaming?.id === version.id" class="version-rename">
					<NcTextField v-model="renaming.label" label="Version name" />
					<NcButton variant="primary" :disabled="busy" @click="saveName(version.id, renaming.label)">
						Save name
					</NcButton>
					<NcButton :disabled="busy" @click="renaming = null">
						Cancel
					</NcButton>
				</div>
			</li>
		</ol>
		<section v-if="preview" class="version-preview" aria-label="Preview of an older version">
			<pre tabindex="0">{{ preview.text }}</pre>
			<NcButton @click="preview = null">
				Close preview
			</NcButton>
		</section>
		<template #actions>
			<NcButton @click="emit('close')">
				Close
			</NcButton>
		</template>
	</NcDialog>
</template>

<style scoped>
.version-list { list-style: none; padding: 0; margin: 0; }
.version-row { padding: 8px 0; border-bottom: 1px solid var(--color-border); }
.version-info, .version-actions, .version-rename, .version-offer {
	display: flex;
	align-items: center;
	flex-wrap: wrap;
	gap: 8px;
}
.version-name { font-style: italic; }
.version-preview pre {
	max-height: 40vh;
	overflow: auto;
	white-space: pre-wrap;
	padding: 8px;
	background: var(--color-background-hover);
}
</style>
