<script setup>
import { onBeforeUnmount, ref, watch } from 'vue'
import VersionsPanel from './VersionsPanel.vue'
import { versionsSidebar as state } from '../views/versionsSidebarState.js'

const panel = ref(null)
watch(panel, (value) => {
	state.restore = value ? (id) => value.restore(id) : null
})
onBeforeUnmount(() => {
	state.restore = null
})
</script>

<template>
	<VersionsPanel
		v-if="state.active"
		ref="panel"
		:fileId="state.fileId"
		:open="state.open"
		:outlineName="state.title"
		:selectedId="state.selectedId"
		:flush="state.flush"
		:reload="state.reload"
		@preview="state.onPreview"
		@restored="state.onRestored"
		@close="state.onClose" />
</template>
