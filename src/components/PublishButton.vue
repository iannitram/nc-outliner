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
import { computed, ref } from 'vue'
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
})

const emit = defineEmits(['published'])

const publishing = ref(false)
/** Link to the last published doc; the user clicks it (no popup block). */
const openUrl = ref('')

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
		const picker = getFilePickerBuilder('Publish to Doc')
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
	openUrl.value = ''
	try {
		if (props.beforePublish && !(await props.beforePublish())) {
			showError('Could not save your latest changes, so nothing was published. Try again.')
			return
		}
		const result = await publish(props.fileId, chosenFolder, defaultName.value)
		showSuccess(`Published to ${result.path}`)
		openUrl.value = result.openUrl || ''
		emit('published', result.path)
	} catch (error) {
		showError(error.message || 'Could not publish document')
	} finally {
		publishing.value = false
	}
}
</script>

<template>
	<span class="publish-button">
		<NcButton :disabled="publishing" @click="onPublishClick">
			Publish to Doc
		</NcButton>
		<a
			v-if="openUrl"
			class="publish-open-link"
			:href="openUrl"
			target="_blank"
			rel="noopener">Open document</a>
	</span>
</template>
