<script setup>
import { NcActionButton, NcActions, NcButton } from '@nextcloud/vue'
import { computed, onMounted, onUnmounted, ref } from 'vue'
import PublishButton from './PublishButton.vue'

const props = defineProps({
	title: {
		type: String,
		default: '',
	},
	fileId: {
		type: Number,
		required: true,
	},
	publishPath: {
		type: String,
		default: null,
	},
	name: {
		type: String,
		default: '',
	},
	beforePublish: {
		type: Function,
		default: null,
	},
	isNarrow: {
		type: Boolean,
		default: false,
	},
	/** True while a read-only version preview is shown: there is nothing to sort. */
	sortDisabled: {
		type: Boolean,
		default: false,
	},
})

defineEmits(['published', 'openVersions', 'openSort'])

const topBarRef = ref(null)
const observedNarrow = ref(false)

const effectiveNarrow = computed(() => {
	return props.isNarrow || observedNarrow.value
})

let observer = null

onMounted(() => {
	if (typeof ResizeObserver !== 'undefined' && topBarRef.value) {
		observer = new ResizeObserver((entries) => {
			for (const entry of entries) {
				const width = entry.contentRect?.width ?? entry.target.getBoundingClientRect?.()?.width ?? 0
				observedNarrow.value = width < 760
			}
		})
		observer.observe(topBarRef.value)
	}
})

onUnmounted(() => {
	observer?.disconnect()
})
</script>

<template>
	<header ref="topBarRef" class="outline-top-bar tb" :class="{ 'outline-top-bar--narrow': effectiveNarrow }">
		<span class="nav-toggle-spacer" aria-hidden="true" />
		<h1 class="title" :title="title">
			{{ title }}
		</h1>
		<span class="spacer sp" />
		<PublishButton
			:fileId="fileId"
			:publishPath="publishPath"
			:name="name"
			:title="title"
			:beforePublish="beforePublish"
			:iconOnly="effectiveNarrow"
			@published="(path, openUrl) => $emit('published', path, openUrl)" />
		<NcButton
			ariaLabel="Versions"
			title="Versions"
			type="button"
			variant="tertiary"
			@click="$emit('openVersions')">
			<template #icon>
				<svg
					viewBox="0 0 24 24"
					width="20"
					height="20"
					aria-hidden="true">
					<path
						fill="none"
						stroke="currentColor"
						stroke-width="2"
						stroke-linecap="round"
						stroke-linejoin="round"
						d="M3.5 12a8.5 8.5 0 1 0 2.6-6.1 M3.5 4.5v4h4 M12 7.5V12l3 2" />
				</svg>
			</template>
		</NcButton>
		<NcActions :forceMenu="true" ariaLabel="More actions">
			<slot name="actions">
				<NcActionButton :disabled="sortDisabled" @click="$emit('openSort')">
					<template #icon>
						<svg
							viewBox="0 0 24 24"
							width="20"
							height="20"
							aria-hidden="true">
							<path
								fill="none"
								stroke="currentColor"
								stroke-width="2"
								stroke-linecap="round"
								stroke-linejoin="round"
								d="M7 4v16 M4 17l3 3 3-3 M13 6h8 M13 11h6 M13 16h4" />
						</svg>
					</template>
					Sort rows…
				</NcActionButton>
				<NcActionButton @click="$emit('openVersions')">
					Versions
				</NcActionButton>
			</slot>
		</NcActions>
	</header>
</template>

<style scoped>
.outline-top-bar {
	min-width: 0;
	height: 52px;
	flex: none;
	display: flex;
	align-items: center;
	gap: 4px;
	padding: 0 10px 0 8px;
	border-bottom: 1px solid transparent;
	container-type: inline-size;
}

.nav-toggle-spacer {
	width: var(--default-clickable-area, 44px);
	height: var(--default-clickable-area, 44px);
	flex: none;
}

.title {
	font-size: 16px;
	font-weight: 600;
	white-space: nowrap;
	overflow: hidden;
	text-overflow: ellipsis;
	min-width: 0;
	padding: 0 6px;
	margin: 0;
	color: var(--color-main-text);
}

.spacer {
	flex: 1;
}
.outline-top-bar > :deep(.publish-button),
.outline-top-bar > :deep(.button-vue),
.outline-top-bar > :deep(.action-item) {
	flex: none;
}

.outline-top-bar--narrow {
	padding-inline: 4px;
}
</style>
