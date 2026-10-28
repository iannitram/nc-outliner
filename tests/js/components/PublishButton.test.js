import { getFilePickerBuilder, showError, showSuccess } from '@nextcloud/dialogs'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import PublishButton, { getDefaultDocName, getStartFolder } from '../../../src/components/PublishButton.vue'
import { publish } from '../../../src/api/outlines.js'

const pickMock = vi.fn()
const builderMock = {
	setMultiSelect: vi.fn().mockReturnThis(),
	allowDirectories: vi.fn().mockReturnThis(),
	setMimeTypeFilter: vi.fn().mockReturnThis(),
	addButton: vi.fn().mockReturnThis(),
	startAt: vi.fn().mockReturnThis(),
	build: vi.fn().mockReturnValue({
		pick: pickMock,
	}),
}

vi.mock('@nextcloud/dialogs', () => ({
	getFilePickerBuilder: vi.fn(() => builderMock),
	showSuccess: vi.fn(),
	showError: vi.fn(),
}))

vi.mock('../../../src/api/outlines.js', () => ({
	publish: vi.fn(),
}))

describe('PublishButton.vue', () => {
	let wrapper

	beforeEach(() => {
		vi.clearAllMocks()
		vi.spyOn(window, 'open').mockImplementation(() => {})
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
		vi.restoreAllMocks()
	})

	describe('helpers', () => {
		it('determines the start folder from publishPath', () => {
			expect(getStartFolder(null)).toBe('/Outlines')
			expect(getStartFolder('')).toBe('/Outlines')
			expect(getStartFolder('/Plan.odt')).toBe('/')
			expect(getStartFolder('/Documents/Plan.odt')).toBe('/Documents')
			expect(getStartFolder('/Documents/Sub/Plan.odt')).toBe('/Documents/Sub')
			expect(getStartFolder('Documents/Plan.odt')).toBe('/Documents')
		})

		it('determines default doc name from publishPath or outline name', () => {
			expect(getDefaultDocName(null, 'Trip Plan', 'Trip.opml')).toBe('Trip Plan')
			expect(getDefaultDocName(null, '', 'Trip.opml')).toBe('Trip')
			expect(getDefaultDocName('/Documents/Export.odt', 'Trip Plan')).toBe('Export')
			expect(getDefaultDocName('/Documents/Export', 'Trip Plan')).toBe('Export')
			expect(getDefaultDocName(null, '', '')).toBe('Untitled')
		})
	})

	it('picks start folder and default name when publishPath is null, publishes and opens openUrl', async () => {
		pickMock.mockResolvedValue('/Documents')
		publish.mockResolvedValue({
			fileId: 44,
			path: '/Documents/Plan.odt',
			openUrl: '/apps/files/?openfile=true&fileid=44',
		})

		wrapper = mount(PublishButton, {
			props: {
				fileId: 7,
				publishPath: null,
				name: 'Plan.opml',
				title: 'Plan',
			},
		})

		const button = wrapper.get('button')
		expect(button.text()).toContain('Publish to Doc')
		await button.trigger('click')
		await flushPromises()

		expect(getFilePickerBuilder).toHaveBeenCalledWith('Publish to Doc')
		expect(builderMock.setMultiSelect).toHaveBeenCalledWith(false)
		expect(builderMock.allowDirectories).toHaveBeenCalledWith(true)
		expect(builderMock.setMimeTypeFilter).toHaveBeenCalledWith(['httpd/unix-directory'])
		expect(builderMock.startAt).toHaveBeenCalledWith('/Outlines')
		expect(pickMock).toHaveBeenCalledTimes(1)
		expect(publish).toHaveBeenCalledWith(7, '/Documents', 'Plan')
		expect(showSuccess).toHaveBeenCalledWith('Published to /Documents/Plan.odt')
		expect(wrapper.emitted('published')).toEqual([['/Documents/Plan.odt']])
		expect(wrapper.emitted('publish')).toBeUndefined()
		// No popup: window.open is never used, the user clicks a link instead.
		expect(window.open).not.toHaveBeenCalled()
		const link = wrapper.get('a.publish-open-link')
		expect(link.text()).toBe('Open document')
		expect(link.attributes('href')).toBe('/apps/files/?openfile=true&fileid=44')
		expect(link.attributes('target')).toBe('_blank')
	})

	it('adds a Choose button whose callback confirms the folder (pick resolves its path)', async () => {
		// Same resolution the real library does: the dialog closes with the
		// nodes passed to the button callback and pick() returns nodes[0].path.
		let button
		builderMock.addButton.mockImplementationOnce((b) => {
			button = b
			return builderMock
		})
		pickMock.mockImplementation(async () => {
			await button.callback([{ path: '/Documents/Trips' }])
			return '/Documents/Trips'
		})
		publish.mockResolvedValue({ fileId: 1, path: '/Documents/Trips/Plan.odt', openUrl: '/o' })
		wrapper = mount(PublishButton, { props: { fileId: 7, publishPath: null, name: 'Plan.opml', title: 'Plan' } })
		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(builderMock.addButton).toHaveBeenCalledTimes(1)
		expect(button.label).toBe('Publish here')
		expect(button.variant).toBe('primary')
		expect(typeof button.callback).toBe('function')
		expect(publish).toHaveBeenCalledWith(7, '/Documents/Trips', 'Plan')
	})

	it('picks start folder and default name when publishPath is set', async () => {
		pickMock.mockResolvedValue('/Work/Reports')
		publish.mockResolvedValue({
			fileId: 55,
			path: '/Work/Reports/Q1Summary.odt',
			openUrl: '/apps/files/?openfile=true&fileid=55',
		})

		wrapper = mount(PublishButton, {
			props: {
				fileId: 12,
				publishPath: '/Work/Reports/Q1Summary.odt',
				name: 'Summary.opml',
				title: 'Summary',
			},
		})

		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(builderMock.startAt).toHaveBeenCalledWith('/Work/Reports')
		expect(publish).toHaveBeenCalledWith(12, '/Work/Reports', 'Q1Summary')
		expect(wrapper.emitted('published')).toEqual([['/Work/Reports/Q1Summary.odt']])
		expect(wrapper.get('a.publish-open-link').attributes('href')).toBe('/apps/files/?openfile=true&fileid=55')
	})

	it('does nothing when the folder picker is cancelled', async () => {
		pickMock.mockRejectedValue(new Error('FilePicker: No nodes selected'))

		wrapper = mount(PublishButton, {
			props: {
				fileId: 7,
				publishPath: null,
				name: 'Plan.opml',
			},
		})

		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(publish).not.toHaveBeenCalled()
		expect(showSuccess).not.toHaveBeenCalled()
		expect(showError).not.toHaveBeenCalled()
		expect(wrapper.emitted('published')).toBeUndefined()
		expect(wrapper.find('a.publish-open-link').exists()).toBe(false)
	})

	it('does nothing when the folder picker resolves with an empty value', async () => {
		pickMock.mockResolvedValue('')

		wrapper = mount(PublishButton, {
			props: {
				fileId: 7,
				publishPath: null,
				name: 'Plan.opml',
			},
		})

		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(publish).not.toHaveBeenCalled()
		expect(wrapper.emitted('published')).toBeUndefined()
	})

	it('disables the button while publishing', async () => {
		let resolvePublish
		const publishPromise = new Promise((resolve) => {
			resolvePublish = resolve
		})
		pickMock.mockResolvedValue('/Documents')
		publish.mockReturnValue(publishPromise)

		wrapper = mount(PublishButton, {
			props: {
				fileId: 7,
				publishPath: null,
				name: 'Plan.opml',
			},
		})

		const button = wrapper.get('button')
		expect(button.attributes('disabled')).toBeUndefined()

		await button.trigger('click')
		await flushPromises()

		expect(button.attributes('disabled')).toBeDefined()

		resolvePublish({
			fileId: 44,
			path: '/Documents/Plan.odt',
			openUrl: '/open',
		})
		await flushPromises()

		expect(button.attributes('disabled')).toBeUndefined()
	})

	it('saves pending edits after the folder is picked and before publishing', async () => {
		const calls = []
		pickMock.mockImplementation(async () => {
			calls.push('pick')
			return '/Documents'
		})
		const beforePublish = vi.fn(async () => {
			calls.push('save')
			return true
		})
		publish.mockImplementation(async () => {
			calls.push('publish')
			return { fileId: 44, path: '/Documents/Plan.odt', openUrl: '/open' }
		})

		wrapper = mount(PublishButton, {
			props: { fileId: 7, publishPath: null, name: 'Plan.opml', title: 'Plan', beforePublish },
		})
		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(calls).toEqual(['pick', 'save', 'publish'])
		expect(publish).toHaveBeenCalledWith(7, '/Documents', 'Plan')
		expect(showError).not.toHaveBeenCalled()
	})

	it('does not publish and shows an error when pending edits cannot be saved', async () => {
		pickMock.mockResolvedValue('/Documents')
		const beforePublish = vi.fn(async () => false)

		wrapper = mount(PublishButton, {
			props: { fileId: 7, publishPath: null, name: 'Plan.opml', title: 'Plan', beforePublish },
		})
		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(beforePublish).toHaveBeenCalledTimes(1)
		expect(publish).not.toHaveBeenCalled()
		expect(showError).toHaveBeenCalledWith('Could not save your latest changes, so nothing was published. Try again.')
		expect(showSuccess).not.toHaveBeenCalled()
		expect(wrapper.emitted('published')).toBeUndefined()
		expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
	})

	it('shows error toast when publish fails', async () => {
		pickMock.mockResolvedValue('/Documents')
		publish.mockRejectedValue(new Error('Destination folder does not exist'))

		wrapper = mount(PublishButton, {
			props: {
				fileId: 7,
				publishPath: null,
				name: 'Plan.opml',
			},
		})

		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(showError).toHaveBeenCalledWith('Destination folder does not exist')
		expect(showSuccess).not.toHaveBeenCalled()
		expect(wrapper.emitted('published')).toBeUndefined()
		expect(window.open).not.toHaveBeenCalled()
		expect(wrapper.get('button').attributes('disabled')).toBeUndefined()
	})
})
