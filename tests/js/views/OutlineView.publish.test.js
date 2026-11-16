import { getFilePickerBuilder, showError } from '@nextcloud/dialogs'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineView from '../../../src/views/OutlineView.vue'
import { publish, readOutline, saveOutline } from '../../../src/api/outlines.js'

if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

const pickMock = vi.fn()
const builderMock = {
	setMultiSelect: vi.fn().mockReturnThis(),
	allowDirectories: vi.fn().mockReturnThis(),
	setMimeTypeFilter: vi.fn().mockReturnThis(),
	addButton: vi.fn().mockReturnThis(),
	startAt: vi.fn().mockReturnThis(),
	build: vi.fn(() => ({ pick: pickMock })),
}

vi.mock('@nextcloud/dialogs', () => ({
	getFilePickerBuilder: vi.fn(() => builderMock),
	showSuccess: vi.fn(),
	showError: vi.fn(),
}))

vi.mock('../../../src/api/outlines.js', () => ({
	readOutline: vi.fn(),
	saveCopy: vi.fn(),
	saveOutline: vi.fn(),
	publish: vi.fn(),
}))

vi.mock('../../../src/components/OutlineEditor.vue', () => ({
	default: {
		props: ['history'],
		methods: {
			edit() {
				this.history.execute((rows) => [{ ...rows[0], text: 'Edited' }], [])
			},
		},
		template: '<button @click="edit">Edit outline</button>',
	},
}))

const initialOutline = {
	title: 'Plan',
	rows: [{ id: 'r1', text: 'First', note: '', collapsed: false, children: [] }],
	publishPath: null,
}

const SAVE_FAILED_MESSAGE = 'Could not save your latest changes, so nothing was published. Try again.'

/**
 * Find a button by its visible text.
 *
 * @param {import('@vue/test-utils').VueWrapper} wrapper mounted view
 * @param {string} text button text
 * @return {import('@vue/test-utils').DOMWrapper} the button
 */
function buttonWithText(wrapper, text) {
	return wrapper.findAll('button').find((button) => button.text() === text)
}

describe('OutlineView Publish flushes the pending autosave first (#170)', () => {
	let wrapper

	beforeEach(() => {
		vi.clearAllMocks()
		pickMock.mockResolvedValue('/Documents')
		readOutline.mockResolvedValue({ fileId: 3, name: 'Plan.opml', etag: 'etag-1', outline: initialOutline })
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
		document.body.innerHTML = ''
	})

	it('saves the edit before the publish request and publishes after the save resolved', async () => {
		const calls = []
		saveOutline.mockImplementation(async () => {
			calls.push('save')
			await new Promise((resolve) => setTimeout(resolve, 20))
			calls.push('saved')
			return { ok: true, etag: 'etag-2' }
		})
		publish.mockImplementation(async () => {
			calls.push('publish')
			return { fileId: 44, path: '/Documents/Plan.odt', openUrl: '/open' }
		})

		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		await buttonWithText(wrapper, 'Edit outline').trigger('click')
		// Publish within the 1.5 s autosave debounce window: no save has started yet.
		await buttonWithText(wrapper, 'Publish').trigger('click')
		await vi.waitFor(() => expect(publish).toHaveBeenCalledTimes(1))

		expect(calls).toEqual(['save', 'saved', 'publish'])
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({
			rows: [expect.objectContaining({ text: 'Edited' })],
		}), 'etag-1')
		expect(publish).toHaveBeenCalledWith(3, '/Documents', 'Plan')
		expect(showError).not.toHaveBeenCalled()
	})

	it('does not publish and shows an error when the pending save fails', async () => {
		saveOutline.mockRejectedValue(new Error('offline'))

		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		await buttonWithText(wrapper, 'Edit outline').trigger('click')
		await buttonWithText(wrapper, 'Publish').trigger('click')
		await vi.waitFor(() => expect(showError).toHaveBeenCalledWith(SAVE_FAILED_MESSAGE))

		expect(saveOutline).toHaveBeenCalledTimes(1)
		expect(publish).not.toHaveBeenCalled()
		expect(getFilePickerBuilder).toHaveBeenCalledTimes(1)
	})
})
