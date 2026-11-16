<script>
/**
 * Determine the starting folder for the file picker.
 *
 * @param {string|null} publishPath outline's previous publish path
 * @return {string} starting folder path
 */
export function getStartFolder(publishPath) {
	if (!publishPath) {
		return '/Outlines'
	}
	const lastSlash = publishPath.lastIndexOf('/')
	if (lastSlash === -1) {
		return '/Outlines'
	}
	if (lastSlash === 0) {
		return '/'
	}
	const folder = publishPath.slice(0, lastSlash)
	return folder.startsWith('/') ? folder : `/${folder}`
}

/**
 * Determine the default document name without .odt extension.
 *
 * @param {string|null} publishPath outline's previous publish path
 * @param {string} [title] outline title
 * @param {string} [name] outline file name
 * @return {string} default document name
 */
export function getDefaultDocName(publishPath, title = '', name = '') {
	if (publishPath) {
		const fileName = publishPath.slice(publishPath.lastIndexOf('/') + 1)
		const baseName = fileName.replace(/\.odt$/i, '')
		if (baseName) {
			return baseName
		}
	}
	const rawName = title || name || 'Untitled'
	return rawName.replace(/\.opml$/i, '')
}
</script>

<script setup>
import { getFilePickerBuilder, showError, showSuccess } from '@nextcloud/dialogs'
import { NcButton } from '@nextcloud/vue'
import { computed, onUnmounted, ref } from 'vue'
import { publish } from '../api/outlines.js'

const props = defineProps({
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
	title: {
		type: String,
		default: '',
	},
	/**
	 * Saves pending edits; resolves false when they could not be saved.
	 * Publish reads the server's copy, so it must not run after a failed save.
	 */
	beforePublish: {
		type: Function,
		default: null,
	},
	iconOnly: {
		type: Boolean,
		default: false,
	},
})

const emit = defineEmits(['published'])

const publishing = ref(false)
const published = ref(false)
let publishedTimer
const buttonLabel = computed(() => publishing.value ? 'Publishing…' : published.value ? 'Published' : 'Publish')
onUnmounted(() => clearTimeout(publishedTimer))

const startFolder = computed(() => getStartFolder(props.publishPath))
const defaultName = computed(() => getDefaultDocName(props.publishPath, props.title, props.name))

/**
 * Open the folder picker and publish to an .odt document.
 */
async function onPublishClick() {
	if (publishing.value) {
		return
	}

	let chosenFolder
	try {
		const picker = getFilePickerBuilder(`Publish "${defaultName.value}.odt" to…`)
			.setMultiSelect(false)
			.allowDirectories(true)
			.setMimeTypeFilter(['httpd/unix-directory'])
			// With allowDirectories the picker hands the current folder to the
			// callback when no row is selected, and pick() resolves its path.
			.addButton({
				label: 'Publish here',
				variant: 'primary',
				callback: () => {},
			})
			.startAt(startFolder.value)
			.build()
		chosenFolder = await picker.pick()
	} catch {
		return
	}

	if (!chosenFolder) {
		return
	}

	publishing.value = true
	published.value = false
	clearTimeout(publishedTimer)
	try {
		if (props.beforePublish && !(await props.beforePublish())) {
			showError('Could not save your latest changes, so nothing was published. Try again.')
			return
		}
		const result = await publish(props.fileId, chosenFolder, defaultName.value)
		showSuccess(`Published to ${result.path}`)
		published.value = true
		publishedTimer = setTimeout(() => {
			published.value = false
		}, 3000)
		emit('published', result.path, result.openUrl || '')
	} catch (error) {
		showError(error.message || 'Could not publish document')
	} finally {
		publishing.value = false
	}
}
</script>

<template>
	<span class="publish-button">
		<NcButton
			:disabled="publishing"
			:ariaLabel="iconOnly ? buttonLabel : undefined"
			:title="iconOnly ? buttonLabel : undefined"
			variant="tertiary"
			@click="onPublishClick">
			<template #icon>
				<svg
					class="publish-icon"
					:class="{ published }"
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
						:d="published ? 'M5 12.5l4.5 4.5L19 7.5' : 'M14 3H6.5A1.5 1.5 0 0 0 5 4.5v15A1.5 1.5 0 0 0 6.5 21h11a1.5 1.5 0 0 0 1.5-1.5V8z M14 3v5h5 M9 14.5l3-3 3 3 M12 11.5V17.5'" />
				</svg>
			</template>
			<span v-if="!iconOnly" class="publish-button-text">{{ buttonLabel }}</span>
		</NcButton>
	</span>
</template>

<style scoped>
.publish-icon {
	flex: none;
}

.publish-icon.published {
	color: var(--color-success);
}

@container (max-width: 759px) {
	.publish-button-text {
		display: none;
	}
}
</style>
