<script setup>
defineProps({ status: { type: String, required: true } })
</script>

<template>
	<p class="save-status" role="status" aria-live="polite">
		{{ status === 'saving' ? 'Saving…' : status === 'error' ? "Can't save (retrying)" : status === 'conflict' ? 'Changed elsewhere' : 'Saved' }}
	</p>
</template>
