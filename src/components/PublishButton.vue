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
})

const emit = defineEmits(['publish', 'published', 'update:publishPath'])

const publishing = ref(false)

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
	try {
		const result = await publish(props.fileId, chosenFolder, defaultName.value)
		showSuccess(`Published to ${result.path}`)
		emit('publish', result.path)
		emit('published', result.path)
		emit('update:publishPath', result.path)
		if (result.openUrl) {
			window.open(result.openUrl, '_blank')
		}
	} catch (error) {
		showError(error.message || 'Could not publish document')
	} finally {
		publishing.value = false
	}
}
</script>

<template>
	<NcButton :disabled="publishing" @click="onPublishClick">
		Publish to Doc
	</NcButton>
</template>
