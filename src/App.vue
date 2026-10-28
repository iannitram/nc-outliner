<script setup>
import { NcAppContent, NcAppNavigation, NcAppNavigationSettings, NcButton, NcContent, NcThemeProvider } from '@nextcloud/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import ThemeSetting from './components/ThemeSetting.vue'
import OutlineList from './views/OutlineList.vue'
import OutlineView from './views/OutlineView.vue'
import { getSettings } from './api/outlines.js'

const hash = ref(window.location.hash)
const outlineView = ref(null)
const theme = ref('auto')
const settingsLoading = ref(true)
const settingsError = ref('')
let hashChangeGeneration = 0
const fileId = computed(() => {
	const match = hash.value.match(/^#\/outline\/(\d+)$/)
	return match ? Number(match[1]) : null
})

/**
 *
 */
async function syncHash() {
	const generation = ++hashChangeGeneration
	const nextHash = window.location.hash
	const currentId = hash.value.match(/^#\/outline\/(\d+)$/)?.[1]
	const nextId = nextHash.match(/^#\/outline\/(\d+)$/)?.[1]
	if (currentId && currentId !== nextId && outlineView.value?.beforeLeave) {
		const canLeave = await outlineView.value.beforeLeave()
		if (!canLeave) {
			if (generation === hashChangeGeneration) {
				window.location.hash = hash.value
			}
			return
		}
	}
	if (generation === hashChangeGeneration) {
		hash.value = nextHash
	}
}

/**
 *
 * @param {number} id outline file id
 */
function openOutline(id) {
	window.location.hash = `#/outline/${id}`
}

/**
 *
 */
function showList() {
	window.location.hash = ''
}

onMounted(async () => {
	window.addEventListener('hashchange', syncHash)
	try {
		const settings = await getSettings()
		theme.value = settings.theme
	} catch {
		settingsError.value = 'Could not load the theme setting.'
	} finally {
		settingsLoading.value = false
	}
})
onUnmounted(() => window.removeEventListener('hashchange', syncHash))
</script>

<template>
	<NcThemeProvider :dark="theme === 'dark'" :light="theme === 'light'">
		<NcContent appName="nc_outliner">
			<NcAppNavigation ariaLabel="Outliner navigation">
				<NcButton @click="showList">
					My outlines
				</NcButton>
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
				<OutlineList v-else @open="openOutline" />
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
</style>
