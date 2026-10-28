<script setup>
import { NcActionButton, NcActions, NcAppSidebar, NcButton, NcIconSvgWrapper, NcNoteCard, NcTextField } from '@nextcloud/vue'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listOutlines } from '../api/outlines.js'
import { listVersions, nameVersion, readVersion, restoreVersion } from '../api/versions.js'
import { mdiAlertOutline, mdiTagOutline } from '../icons.js'
import { parseVersionTree } from '../model/versionTree.js'

/**
 * The outline's versions (ADR 0004) in the right-hand sidebar: a list grouped by day, restore, and
 * naming in place, through the WebDAV client. Picking a version asks the view (`preview`) to show it
 * read-only in the main area. The view supplies `flush` (saves pending edits; resolves false if
 * something is still unsaved) and `reload` (reloads the outline and its etag through its own load path).
 */
const props = defineProps({
	fileId: { type: Number, required: true },
	open: { type: Boolean, required: true },
	flush: { type: Function, required: true },
	reload: { type: Function, required: true },
	/** The outline's title, shown under "Versions". */
	outlineName: { type: String, default: '' },
	/** The id of the version the main area is showing, or null for the current outline. */
	selectedId: { type: String, default: null },
})
const emit = defineEmits(['close', 'preview', 'restored'])

const versions = ref([])
const loading = ref(false)
const busy = ref(false)
const error = ref('')
const notice = ref('')
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
 * The calendar day of a time, in local time, as a number that compares for equality.
 *
 * @param {Date} date the date
 * @return {number} the local day
 */
function dayOf(date) {
	return new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
}

/**
 * Which group a version belongs to, by its local date.
 *
 * @param {number} time milliseconds since 1970
 * @return {'Today'|'Yesterday'|'Earlier'} the group
 */
function groupOf(time) {
	const now = new Date()
	const day = dayOf(new Date(time))
	if (day === dayOf(now)) {
		return 'Today'
	}
	if (day === dayOf(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 1))) {
		return 'Yesterday'
	}
	return 'Earlier'
}

const currentVersion = computed(() => versions.value.find(isCurrent) ?? null)
const groups = computed(() => ['Today', 'Yesterday', 'Earlier']
	.map((name) => ({
		name,
		items: versions.value.filter((v) => v !== currentVersion.value && groupOf(v.time) === name),
	}))
	.filter((group) => group.items.length > 0))
// Current first (no heading), then the day groups.
const sections = computed(() => [...(currentVersion.value ? [{ name: '', items: [currentVersion.value] }] : []), ...groups.value])

/**
 * Whether the main area is showing this entry (the live file when no older version is picked).
 *
 * @param {{id: string}} version the entry
 * @return {boolean} true when shown
 */
function isShown(version) {
	return props.selectedId === version.id || (props.selectedId === null && isCurrent(version))
}

/**
 * The time shown on a row: just the clock time for today and yesterday, the date as well for older ones.
 *
 * @param {{time: number}} version the entry
 * @return {string} the label
 */
function rowTime(version) {
	const date = new Date(version.time)
	return groupOf(version.time) === 'Earlier'
		? date.toLocaleString(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
		: date.toLocaleTimeString(undefined, { timeStyle: 'short' })
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
	notice.value = ''
	renaming.value = null
	unreadable.value = new Set()
	loading.value = true
	await loadList()
	loading.value = false
}, { immediate: true })

/**
 * Pick a version: the main area shows it read-only (or the current outline again for the live file).
 * A version that cannot be read or is not OPML is marked, and loses its Restore.
 *
 * @param {{id: string, time: number}} version the version
 */
async function select(version) {
	error.value = ''
	notice.value = ''
	if (isCurrent(version)) {
		emit('preview', null)
		return
	}
	let tree
	try {
		tree = parseVersionTree(await readVersion(props.fileId, version.id))
	} catch {
		tree = null
	}
	if (tree === null) {
		unreadable.value = new Set([...unreadable.value, version.id])
	}
	emit('preview', { id: version.id, time: version.time, tree })
}

/**
 * Save pending edits, note the live file's mtime (the id its state is kept under), restore one
 * older version, reload the outline, and offer to name the state from before the restore.
 *
 * @param {string} id version id to restore
 */
async function restore(id) {
	error.value = ''
	notice.value = ''
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
	renaming.value = null
	emit('restored')
	await props.reload()
	await loadList()
	const kept = beforeId === null ? undefined : versions.value.find((v) => Math.floor(v.time / 1000) === beforeId)
	if (kept) {
		offer.value = { id: kept.id, label: `Before restore ${formatTime(kept.time)}`, time: formatTime(kept.time) }
	} else {
		notice.value = 'Restored. The state from before the restore could not be found in the list, so it cannot be named.'
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
	notice.value = ''
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

defineExpose({ restore })

/**
 * Escape closes the sidebar from anywhere inside it (NcAppSidebar only does this on a phone).
 *
 * @param {KeyboardEvent} event the keydown
 */
function onEscape(event) {
	if (event.key !== 'Escape' || event.defaultPrevented || !props.open) {
		return
	}
	const target = event.target
	if (target === document.body || target === document || target.closest?.('#app-sidebar-vue')) {
		emit('close')
	}
}

onMounted(() => document.addEventListener('keydown', onEscape))
onBeforeUnmount(() => document.removeEventListener('keydown', onEscape))
</script>

<template>
	<NcAppSidebar
		v-if="open"
		class="versions-sidebar"
		name="Versions"
		:subname="outlineName"
		:open="true"
		noToggle
		@close="emit('close')">
		<div class="versions-body">
			<p v-if="loading" role="status">
				Loading versions…
			</p>
			<NcNoteCard v-if="notice" type="info">
				{{ notice }}
			</NcNoteCard>
			<p v-if="error" role="alert" class="version-error">
				{{ error }}
			</p>
			<NcNoteCard v-if="offer" type="success">
				<div class="version-offer">
					<p>Keep the state from before this restore ({{ offer.time }})? A named version is never removed.</p>
					<NcTextField v-model="offer.label" label="Name for the state before the restore" />
					<div class="version-buttons">
						<NcButton variant="primary" :disabled="busy" @click="saveName(offer.id, offer.label)">
							Save name
						</NcButton>
						<NcButton variant="tertiary" :disabled="busy" @click="offer = null">
							Dismiss
						</NcButton>
					</div>
				</div>
			</NcNoteCard>
			<ol v-if="versions.length" class="version-list">
				<template v-for="entry in sections" :key="entry.name">
					<li v-if="entry.name" class="version-group" role="presentation">
						{{ entry.name }}
					</li>
					<li
						v-for="version in entry.items"
						:key="version.id"
						class="version-row"
						:class="{ 'version-row--on': isShown(version), 'version-row--bad': unreadable.has(version.id) }">
						<div class="version-line">
							<button
								type="button"
								class="version-select"
								:aria-current="isShown(version) ? 'true' : undefined"
								@click="select(version)">
								<span class="version-text">
									<time :datetime="new Date(version.time).toISOString()">{{ isCurrent(version) ? 'Current version' : rowTime(version) }}</time>
									<span v-if="isCurrent(version)" class="version-sub">Saved {{ formatTime(version.time) }}</span>
									<span v-else-if="unreadable.has(version.id)" class="version-sub version-unreadable" role="status">
										<NcIconSvgWrapper :path="mdiAlertOutline" :size="14" />{{ UNREADABLE }}
									</span>
									<span v-else-if="version.label" class="version-sub version-name">
										<NcIconSvgWrapper :path="mdiTagOutline" :size="14" />{{ version.label }}
									</span>
									<span v-else-if="isShown(version)" class="version-sub">Showing</span>
								</span>
								<strong v-if="isCurrent(version)" class="version-badge">Current</strong>
							</button>
							<NcActions
								v-if="!isCurrent(version)"
								forceMenu
								:disabled="busy"
								:ariaLabel="`Actions for the version from ${formatTime(version.time)}`">
								<NcActionButton v-if="!unreadable.has(version.id)" @click="restore(version.id)">
									Restore
								</NcActionButton>
								<NcActionButton @click="startRename(version)">
									Name this version
								</NcActionButton>
							</NcActions>
						</div>
						<div v-if="renaming?.id === version.id" class="version-rename">
							<NcTextField
								v-model="renaming.label"
								label="Version name"
								@keydown.enter.prevent="saveName(version.id, renaming.label)"
								@keydown.esc.stop.prevent="renaming = null" />
							<NcButton variant="primary" :disabled="busy" @click="saveName(version.id, renaming.label)">
								Save name
							</NcButton>
							<NcButton variant="tertiary" :disabled="busy" @click="renaming = null">
								Cancel
							</NcButton>
						</div>
					</li>
				</template>
			</ol>
		</div>
	</NcAppSidebar>
</template>

<style scoped>
.versions-body { padding: 0 8px 16px; }
.version-list { list-style: none; padding: 0; margin: 0; }
.version-group {
	padding: 14px 8px 4px;
	font-size: 12.5px;
	font-weight: 600;
	color: var(--color-text-maxcontrast);
}
.version-row { border-radius: var(--border-radius-large, 8px); }
.version-row--on { background: var(--color-background-hover); }
.version-line { display: flex; align-items: center; gap: 4px; }
.version-select {
	flex: 1;
	display: flex;
	align-items: center;
	gap: 8px;
	min-width: 0;
	padding: 8px;
	border: 0;
	border-radius: var(--border-radius-element, 8px);
	background: transparent;
	color: inherit;
	font: inherit;
	text-align: start;
	cursor: pointer;
}
.version-select:hover { background: var(--color-background-hover); }
.version-select:focus-visible { outline: 2px solid var(--color-main-text); outline-offset: -2px; box-shadow: 0 0 0 4px var(--color-main-background); }
.version-text { flex: 1; display: flex; flex-direction: column; min-width: 0; }
.version-sub { font-size: 12.5px; color: var(--color-text-maxcontrast); }
.version-badge {
	padding: 2px 8px;
	border-radius: 10px;
	font-size: 12px;
	background: var(--color-primary-element-light);
	color: var(--color-primary-element-light-text);
}
.version-name { display: flex; align-items: center; gap: 4px; }
.version-unreadable { display: flex; align-items: center; gap: 4px; color: var(--color-error-text); }
.version-rename { display: flex; align-items: center; flex-wrap: wrap; gap: 8px; padding: 4px 8px 8px; }
.version-offer { display: flex; flex-direction: column; gap: 8px; }
.version-buttons { display: flex; gap: 8px; }
.version-error { color: var(--color-error-text); }
</style>
