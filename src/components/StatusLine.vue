<script setup>
import { computed } from 'vue'

const props = defineProps({
	status: {
		type: String,
		required: true,
	},
	rows: {
		type: Array,
		default: () => [],
	},
	rowCount: {
		type: Number,
		default: undefined,
	},
	wordCount: {
		type: Number,
		default: undefined,
	},
	publishPath: {
		type: String,
		default: null,
	},
	openUrl: {
		type: String,
		default: '',
	},
})

const statusText = computed(() => {
	switch (props.status) {
		case 'saving':
			return 'Saving…'
		case 'error':
			return "Can't save. Retrying"
		case 'conflict':
			return 'Changed elsewhere'
		default:
			return 'Saved'
	}
})

const isWarn = computed(() => props.status === 'error')

const treeCounts = computed(() => {
	let rowCount = 0
	let wordCount = 0

	/**
	 * Recursively count rows and words in an outline tree.
	 *
	 * @param {Array} list list of outline rows
	 */
	function countRows(list) {
		if (!Array.isArray(list)) {
			return
		}
		for (const row of list) {
			rowCount++
			const combined = `${row.text || ''} ${row.note || ''}`.trim()
			if (combined) {
				wordCount += combined.split(/\s+/).filter(Boolean).length
			}
			if (row.children && row.children.length > 0) {
				countRows(row.children)
			}
		}
	}

	countRows(props.rows)
	return { rowCount, wordCount }
})

const effectiveRowCount = computed(() => {
	if (props.rowCount !== undefined) {
		return props.rowCount
	}
	return treeCounts.value.rowCount
})

const effectiveWordCount = computed(() => {
	if (props.wordCount !== undefined) {
		return props.wordCount
	}
	return treeCounts.value.wordCount
})

const rowCountLabel = computed(() => {
	const count = effectiveRowCount.value
	return count === 1 ? '1 row' : `${count} rows`
})

const wordCountLabel = computed(() => {
	const count = effectiveWordCount.value
	return count === 1 ? '1 word' : `${count} words`
})

const displayPublishPath = computed(() => {
	if (!props.publishPath) {
		return ''
	}
	return props.publishPath.replace(/^\//, '')
})
</script>

<template>
	<footer class="status-line sl" :class="{ warn: isWarn }">
		<span
			class="save-status status-save"
			:class="{ warn: isWarn }"
			role="status"
			aria-live="polite">
			<svg
				v-if="status === 'error'"
				class="status-icon"
				viewBox="0 0 24 24"
				width="14"
				height="14"
				aria-hidden="true">
				<path
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M12 3.5l9.5 16.5h-19z M12 10v4.5 M12 17.2v.1" />
			</svg>
			<svg
				v-else-if="status === 'saving'"
				class="status-icon status-spin"
				viewBox="0 0 24 24"
				width="14"
				height="14"
				aria-hidden="true">
				<circle
					cx="12"
					cy="12"
					r="8"
					fill="none"
					stroke="currentColor"
					stroke-width="2.4"
					stroke-dasharray="34 50" />
			</svg>
			<svg
				v-else-if="status === 'saved'"
				class="status-icon"
				viewBox="0 0 24 24"
				width="14"
				height="14"
				aria-hidden="true">
				<path
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M5 12.5l4.5 4.5L19 7.5" />
			</svg>
			<b v-if="isWarn">{{ statusText }}</b>
			<span v-else>{{ statusText }}</span>
		</span>
		<span class="status-dot">·</span>
		<span class="status-counts">{{ rowCountLabel }} · {{ wordCountLabel }}</span>
		<span class="status-spacer sp" />
		<a
			v-if="publishPath"
			class="status-link published-link"
			aria-label="Open document"
			:href="openUrl || '#'"
			target="_blank"
			rel="noopener">
			<span class="status-link-label"><span class="publish-path">Published to {{ displayPublishPath }} · </span><b>Open document</b></span>
			<svg
				class="status-icon"
				viewBox="0 0 24 24"
				width="12"
				height="12"
				aria-hidden="true">
				<path
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					stroke-linecap="round"
					stroke-linejoin="round"
					d="M14 4h6v6 M20 4l-8.5 8.5 M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
			</svg>
		</a>
	</footer>
</template>

<style scoped>
.status-line {
	height: 30px;
	flex: none;
	display: flex;
	align-items: center;
	gap: 8px;
	padding: 0 16px;
	border-top: 1px solid var(--color-border);
	font-size: 12.5px;
	color: var(--color-text-maxcontrast);
	white-space: nowrap;
	overflow: hidden;
	background: var(--color-main-background);
	min-width: 0;
}

.save-status {
	display: inline-flex;
	align-items: center;
	gap: 5px;
}

.status-icon {
	flex: none;
}

.status-spin {
	animation: spin 1.2s linear infinite;
}

@keyframes spin {
	100% {
		transform: rotate(360deg);
	}
}

.status-counts,
.status-save,
.status-dot {
	flex: none;
}

.status-spacer {
	flex: 1;
}

.status-link-label {
	min-width: 0;
	overflow: hidden;
	text-overflow: ellipsis;
}

.status-link {
	min-width: 24px;
	color: var(--color-text-maxcontrast);
	text-decoration: none;
	display: inline-flex;
	align-items: center;
	gap: 4px;
	overflow: hidden;
	text-overflow: ellipsis;
}

.status-link b {
	color: var(--color-primary-element);
	font-weight: 600;
}

.status-link:hover {
	text-decoration: underline;
}

.status-line.warn {
	color: var(--color-warning-text, var(--color-error));
	background: var(--color-warning-bg, var(--color-main-background));
}

.save-status.warn {
	color: var(--color-warning-text, var(--color-error));
}
</style>
