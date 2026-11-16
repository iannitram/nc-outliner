<script setup>
import { NcButton, NcDialog } from '@nextcloud/vue'

defineProps({ open: { type: Boolean, required: true }, name: { type: String, required: true } })
const emit = defineEmits(['reload', 'keepCopy'])
</script>

<template>
	<NcDialog
		v-if="open"
		:open="open"
		container="#nc-outliner-dialogs"
		name="Changed somewhere else"
		:noClose="true">
		<p>{{ name }} was changed in another tab or device. Your changes are not saved yet.</p>
		<template #actions>
			<NcButton @click="emit('reload')">
				Reload
			</NcButton>
			<NcButton variant="primary" @click="emit('keepCopy')">
				Keep mine as a copy
			</NcButton>
		</template>
	</NcDialog>
</template>
