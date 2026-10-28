<script setup>
import { NcButton, NcDialog, NcTextField } from '@nextcloud/vue'
import { ref, watch } from 'vue'
import { listOutlines } from '../api/outlines.js'
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
const liveTime = ref(null)
const unreadable = ref(new Set())
const UNREADABLE = "This version can't be opened"

/**
 * Whether an entry is the live file: its time is the file's own modified time (whole seconds).
 *
 * @param {{time: number}} version the entry
 * @return {boolean} true for the live file
 */
function isCurrent(version) {
	return liveTime.value !== null && Math.floor(version.time / 1000) === liveTime.value
}

/**
 * The OPML text as a flat list of row texts with their depth, or null if it is not OPML.
 *
 * @param {string} text the version's file text
 * @return {{depth: number, text: string}[]|null} the rows
 */
function parseRows(text) {
	if (typeof text !== 'string') {
		return null
	}
	// A saved file may start with a BOM or whitespace, which makes DOMParser fail on the XML declaration.
	const clean = text.replace(/^\uFEFF/, '').replace(/^\s+/, '')
	if (clean === '') {
		return null
	}
	let doc
	try {
		doc = new DOMParser().parseFromString(clean, 'application/xml')
	} catch {
		return null
	}
	if (doc.getElementsByTagName('parsererror').length > 0) {
		return null
	}
	const root = doc.documentElement
	if (!root || root.localName !== 'opml') {
		return null
	}
	// Match by local name, so the namespace prefixes (nco:, or none) never matter.
	const body = Array.from(root.children).find((child) => child.localName === 'body')
	if (!body) {
		return null
	}
	const out = []
	const walk = (node, depth) => {
		for (const child of node.children) {
			if (child.localName === 'outline') {
				out.push({ depth, text: child.getAttribute('text') ?? '' })
				walk(child, depth + 1)
			}
		}
	}
	walk(body, 0)
	return out
}

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
		return
	}
	try {
		const entry = (await listOutlines()).find((item) => item.fileId === props.fileId)
		liveTime.value = entry ? entry.mtime : null
	} catch {
		liveTime.value = null // unknown: no entry is marked Current
	}
}

watch(() => props.open, async (isOpen) => {
	if (!isOpen) {
		return
	}
	error.value = ''
	preview.value = null
	renaming.value = null
	unreadable.value = new Set()
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
		const text = await readVersion(props.fileId, id)
		preview.value = { id, rows: parseRows(text) }
	} catch {
		preview.value = null
		unreadable.value = new Set([...unreadable.value, id])
	}
}

/**
 * Save pending edits, note the live file's mtime (the id its state is kept under), restore one
 * older version, reload the outline, and offer to name the state from before the restore.
 *
 * @param {string} id version id to restore
 */
async function restore(id) {
	error.value = ''
	offer.value = null
	let beforeId = null
	busy.value = true
	try {
		if (!await props.flush()) {
			error.value = 'Some changes are not saved yet, so nothing was restored. Try again once the outline is saved.'
			return
		}
		// NC keeps the state from before the restore as the version whose id is the file's mtime NOW.
		beforeId = await liveFileId()
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
	const kept = beforeId === null ? undefined : versions.value.find((v) => Math.floor(v.time / 1000) === beforeId)
	if (kept) {
		offer.value = { id: kept.id, label: `Before restore ${formatTime(kept.time)}`, time: formatTime(kept.time) }
	} else {
		error.value = 'Restored. The state from before the restore could not be found in the list, so it cannot be named.'
	}
}

/**
 * The live file's modified time now (whole seconds), which is the id its state gets as a version
 * once it is restored over. Null if it cannot be read.
 *
 * @return {Promise<number|null>} seconds since 1970
 */
async function liveFileId() {
	try {
		const entry = (await listOutlines()).find((item) => item.fileId === props.fileId)
		return entry ? entry.mtime : null
	} catch {
		return null
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
			<p>Keep the state from before this restore ({{ offer.time }})? A named version is never removed.</p>
			<NcTextField v-model="offer.label" label="Name for the state before the restore" />
			<NcButton variant="primary" :disabled="busy" @click="saveName(offer.id, offer.label)">
				Save name
			</NcButton>
			<NcButton :disabled="busy" @click="offer = null">
				Dismiss
			</NcButton>
		</div>
		<ol v-if="versions.length" class="version-list">
			<li v-for="version in versions" :key="version.id" class="version-row">
				<div class="version-info">
					<time :datetime="new Date(version.time).toISOString()">{{ formatTime(version.time) }}</time>
					<strong v-if="isCurrent(version)">Current</strong>
					<span v-if="version.label" class="version-name">{{ version.label }}</span>
				</div>
				<div v-if="!isCurrent(version)" class="version-actions">
					<NcButton :disabled="busy" @click="showPreview(version.id)">
						Preview
					</NcButton>
					<NcButton :disabled="busy || unreadable.has(version.id)" :title="unreadable.has(version.id) ? UNREADABLE : undefined" @click="restore(version.id)">
						Restore
					</NcButton>
					<NcButton :disabled="busy" @click="startRename(version)">
						Name
					</NcButton>
				</div>
				<p v-if="unreadable.has(version.id)" class="version-unreadable" role="status">
					{{ UNREADABLE }}
				</p>
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
			<ul v-if="preview.rows" class="version-rows">
				<li v-for="(item, i) in preview.rows" :key="i" :style="{ paddingInlineStart: `${item.depth * 20}px` }">
					{{ item.text }}
				</li>
			</ul>
			<p v-else class="version-unreadable" role="status">
				{{ UNREADABLE }}
			</p>
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
.version-rows { list-style: none; padding: 0; margin: 0 0 8px; }
.version-unreadable { color: var(--color-error-text); margin: 4px 0 0; }
.version-name { font-style: italic; }
</style>
