<script setup>
import {
	NcAppContent,
	NcAppNavigation,
	NcAppNavigationItem,
	NcAppNavigationNew,
	NcAppNavigationSettings,
	NcContent,
	NcThemeProvider,
} from '@nextcloud/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ThemeSetting from './components/ThemeSetting.vue'
import OutlineList from './views/OutlineList.vue'
import OutlineView from './views/OutlineView.vue'
import { createOutline, getSettings, listOutlines } from './api/outlines.js'
import { formatOutlineName, formatRelativeTime } from './utils/format.js'

const STORAGE_KEY = 'nc_outliner_last_outline'

const hash = ref(window.location.hash)
const outlineView = ref(null)
const theme = ref('auto')
const settingsLoading = ref(true)
const settingsError = ref('')
const outlines = ref([])
const outlinesLoading = ref(true)
const outlinesError = ref('')
let hashChangeGeneration = 0

const fileId = computed(() => {
	const match = hash.value.match(/^#\/outline\/(\d+)$/)
	return match ? Number(match[1]) : null
})

/**
 * Format an outline's modified time for display in navigation.
 *
 * @param {number} mtime Unix timestamp in seconds
 * @return {string} formatted relative date string
 */
function formatTime(mtime) {
	if (!mtime) {
		return ''
	}
	return formatRelativeTime(mtime)
}

/**
 * Read the last-opened outline fileId from localStorage.
 *
 * @return {number|null} the stored outline id or null
 */
function readLastOpenedOutline() {
	try {
		const raw = localStorage.getItem(STORAGE_KEY)
		if (raw !== null && raw !== '') {
			const parsed = Number(raw)
			return Number.isFinite(parsed) ? parsed : null
		}
	} catch {
		// Storage access can throw (e.g. sandboxed iframe or disabled cookies)
	}
	return null
}

/**
 * Persist the last-opened outline fileId to localStorage.
 *
 * @param {number|null} id outline fileId to store
 */
function writeLastOpenedOutline(id) {
	try {
		if (id !== null && id !== undefined) {
			localStorage.setItem(STORAGE_KEY, String(id))
		}
	} catch {
		// Storage access can throw
	}
}

/**
 * Refresh the list of outlines from the server, sorted newest first.
 */
async function refreshOutlines() {
	outlinesLoading.value = true
	outlinesError.value = ''
	try {
		const list = await listOutlines()
		outlines.value = list.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
	} catch {
		outlinesError.value = 'Could not load your outlines.'
	} finally {
		outlinesLoading.value = false
	}
}

/**
 * Switch to an outline from navigation after flushing unsaved edits.
 *
 * @param {number} id outline file id
 * @param {Event} [event] optional click event to prevent default link navigation
 */
async function selectOutline(id, event) {
	if (event?.preventDefault) {
		event.preventDefault()
	}
	if (fileId.value === id) {
		return
	}
	if (outlineView.value?.beforeLeave) {
		const canLeave = await outlineView.value.beforeLeave()
		if (!canLeave) {
			return
		}
	}
	const nextHash = `#/outline/${id}`
	hash.value = nextHash
	window.location.hash = nextHash
	writeLastOpenedOutline(id)
}

/**
 * Create a new outline and navigate to it after flushing unsaved edits.
 */
async function createNewOutline() {
	if (outlineView.value?.beforeLeave) {
		const canLeave = await outlineView.value.beforeLeave()
		if (!canLeave) {
			return
		}
	}
	try {
		const outline = await createOutline('')
		await refreshOutlines()
		const nextHash = `#/outline/${outline.fileId}`
		hash.value = nextHash
		window.location.hash = nextHash
		writeLastOpenedOutline(outline.fileId)
	} catch {
		outlinesError.value = 'Could not create an outline.'
	}
}

/**
 * Synchronize component state with the window URL hash when hashchange occurs.
 */
async function syncHash() {
	const generation = ++hashChangeGeneration
	const nextHash = window.location.hash
	const currentId = hash.value.match(/^#\/outline\/(\d+)$/)?.[1]
	const currentNumericId = currentId ? Number(currentId) : null

	const nextMatch = nextHash.match(/^#\/outline\/(\d+)$/)
	const nextNumericId = nextMatch ? Number(nextMatch[1]) : null
	const targetOutline = nextNumericId !== null
		? outlines.value.find((o) => o.fileId === nextNumericId)
		: null

	let targetId = targetOutline ? targetOutline.fileId : null

	// An empty or unknown hash while outlines exist must never show the empty state.
	// It should open the last-opened outline, else the newest one.
	if (targetId === null && outlines.value.length > 0) {
		const storedId = readLastOpenedOutline()
		const fallback = outlines.value.find((o) => o.fileId === storedId) || outlines.value[0]
		targetId = fallback.fileId
	}

	if (currentNumericId !== null && currentNumericId !== targetId && outlineView.value?.beforeLeave) {
		const canLeave = await outlineView.value.beforeLeave()
		if (!canLeave) {
			if (generation === hashChangeGeneration) {
				window.location.hash = hash.value
			}
			return
		}
	}

	if (generation === hashChangeGeneration) {
		if (targetId !== null) {
			const resolvedHash = `#/outline/${targetId}`
			hash.value = resolvedHash
			if (window.location.hash !== resolvedHash) {
				window.location.hash = resolvedHash
			}
			writeLastOpenedOutline(targetId)
		} else {
			hash.value = ''
			if (window.location.hash !== '') {
				window.location.hash = ''
			}
		}
	}
}

/**
 * Determine and activate the initial outline on app startup.
 */
function resolveInitialOutline() {
	if (outlines.value.length === 0) {
		hash.value = ''
		window.location.hash = ''
		return
	}

	const hashMatch = window.location.hash.match(/^#\/outline\/(\d+)$/)
	const currentId = hashMatch ? Number(hashMatch[1]) : null

	if (currentId !== null && outlines.value.some((o) => o.fileId === currentId)) {
		writeLastOpenedOutline(currentId)
		hash.value = window.location.hash
		return
	}

	// Empty or unknown hash while outlines exist: open last-opened, else newest.
	const storedId = readLastOpenedOutline()
	const target = outlines.value.find((o) => o.fileId === storedId) || outlines.value[0]
	const nextHash = `#/outline/${target.fileId}`
	hash.value = nextHash
	window.location.hash = nextHash
	writeLastOpenedOutline(target.fileId)
}

/**
 * Handle outline creation or opening from the empty state view.
 *
 * @param {number} newId outline fileId
 */
async function onOutlineOpened(newId) {
	await refreshOutlines()
	await selectOutline(newId)
}

onMounted(async () => {
	window.addEventListener('hashchange', syncHash)
	try {
		const [settings, list] = await Promise.all([
			getSettings().catch(() => {
				settingsError.value = 'Could not load the theme setting.'
				return { theme: 'auto' }
			}),
			listOutlines().catch(() => {
				outlinesError.value = 'Could not load your outlines.'
				return []
			}),
		])
		theme.value = settings.theme
		outlines.value = list.slice().sort((a, b) => (b.mtime || 0) - (a.mtime || 0))
		resolveInitialOutline()
	} finally {
		settingsLoading.value = false
		outlinesLoading.value = false
	}
})

onUnmounted(() => window.removeEventListener('hashchange', syncHash))
</script>

<template>
	<NcThemeProvider :dark="theme === 'dark'" :light="theme === 'light'">
		<NcContent appName="nc_outliner">
			<NcAppNavigation ariaLabel="Outliner navigation">
				<NcAppNavigationNew text="New outline" @click="createNewOutline" />
				<NcAppNavigationItem
					v-for="entry in outlines"
					:key="entry.fileId"
					:name="formatOutlineName(entry.name)"
					:href="`#/outline/${entry.fileId}`"
					:active="entry.fileId === fileId"
					@click="selectOutline(entry.fileId, $event)">
					<template #extra>
						<span class="outline-entry-date" @click.stop="selectOutline(entry.fileId, $event)">
							{{ formatTime(entry.mtime) }}
						</span>
					</template>
				</NcAppNavigationItem>
				<p v-if="outlinesError" role="alert" class="app-settings-error">
					{{ outlinesError }}
				</p>
				<template #footer>
					<NcAppNavigationSettings name="Outliner settings">
						<ThemeSetting
							:modelValue="theme"
							:disabled="settingsLoading"
							@update:modelValue="(val) => theme = val" />
						<p v-if="settingsError" role="alert" class="app-settings-error">
							{{ settingsError }}
						</p>
					</NcAppNavigationSettings>
				</template>
			</NcAppNavigation>
			<NcAppContent>
				<OutlineView v-if="fileId !== null" ref="outlineView" :fileId="fileId" />
				<OutlineList
					v-else-if="!outlinesLoading && outlines.length === 0"
					:error="outlinesError"
					@open="onOutlineOpened"
					@create="onOutlineOpened" />
			</NcAppContent>
		</NcContent>
		<Teleport to="body">
			<NcThemeProvider :dark="theme === 'dark'" :light="theme === 'light'">
				<div id="nc-outliner-dialogs" />
			</NcThemeProvider>
		</Teleport>
	</NcThemeProvider>
</template>

<style scoped>
.app-settings-error {
	color: var(--color-error, var(--color-text-maxcontrast));
}

.outline-entry-date {
	display: block;
	width: 100%;
	font-size: 12.5px;
	color: var(--color-text-maxcontrast);
	padding-inline: calc(var(--default-grid-baseline, 4px) * 4);
	margin-top: -6px;
	margin-bottom: 6px;
	cursor: pointer;
	overflow: hidden;
	white-space: nowrap;
	text-overflow: ellipsis;
}

:deep(.active) .outline-entry-date {
	color: inherit;
	opacity: 0.8;
}
</style>
