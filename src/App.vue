<script setup>
import { NcAppContent, NcAppNavigation, NcButton, NcContent } from '@nextcloud/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import OutlineList from './views/OutlineList.vue'
import OutlineView from './views/OutlineView.vue'

const hash = ref(window.location.hash)
const outlineView = ref(null)
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

onMounted(() => window.addEventListener('hashchange', syncHash))
onUnmounted(() => window.removeEventListener('hashchange', syncHash))
</script>

<template>
	<NcContent appName="nc_outliner">
		<NcAppNavigation ariaLabel="Outliner navigation">
			<NcButton @click="showList">
				My outlines
			</NcButton>
		</NcAppNavigation>
		<NcAppContent>
			<OutlineView v-if="fileId !== null" ref="outlineView" :fileId="fileId" />
			<OutlineList v-else @open="openOutline" />
		</NcAppContent>
	</NcContent>
</template>
