import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineList from '../../../src/views/OutlineList.vue'
import { createOutline } from '../../../src/api/outlines.js'

vi.mock('../../../src/api/outlines.js', () => ({
	createOutline: vi.fn(),
	listOutlines: vi.fn(),
}))

describe('OutlineList', () => {
	let wrapper

	beforeEach(() => {
		createOutline.mockReset()
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
	})

	it('shows the empty state with NcEmptyContent and New outline button', async () => {
		wrapper = mount(OutlineList)
		await flushPromises()

		expect(wrapper.text()).toContain('No outlines yet')
		expect(wrapper.text()).toContain('Outlines are saved as .opml files in the Outlines folder of your Files')
		expect(wrapper.find('button').text()).toContain('New outline')
		expect(wrapper.text()).not.toContain('Import OPML')
	})

	it('triggers create calls the API create function and emits open to open the new outline', async () => {
		createOutline.mockResolvedValue({ fileId: 42, name: '', etag: 'etag-1' })
		wrapper = mount(OutlineList)
		await flushPromises()

		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(createOutline).toHaveBeenCalledWith('')
		expect(wrapper.emitted('open')).toEqual([[42]])
		expect(wrapper.emitted('create')).toEqual([[42]])
	})

	it('displays an error message when creating an outline fails', async () => {
		createOutline.mockRejectedValue(new Error('Network error'))
		wrapper = mount(OutlineList)
		await flushPromises()

		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(wrapper.text()).toContain('Could not create an outline.')
	})
})
