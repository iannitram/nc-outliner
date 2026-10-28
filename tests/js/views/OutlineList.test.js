import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineList from '../../../src/views/OutlineList.vue'
import { createOutline, listOutlines } from '../../../src/api/outlines.js'

vi.mock('../../../src/api/outlines.js', () => ({
	createOutline: vi.fn(),
	listOutlines: vi.fn(),
}))

describe('OutlineList', () => {
	let wrapper

	beforeEach(() => {
		createOutline.mockReset()
		listOutlines.mockReset()
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
	})

	it('shows the empty state when the API returns no outlines', async () => {
		listOutlines.mockResolvedValue([])
		wrapper = mount(OutlineList)
		await flushPromises()

		expect(wrapper.text()).toContain('No outlines yet.')
	})

	it('shows each outline name and modified time in the list', async () => {
		const mtime = 1700000000
		const expectedDate = new Date(mtime * 1000).toLocaleString()
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'First outline', mtime },
			{ fileId: 2, name: 'Second outline', mtime: mtime + 3600 },
		])
		wrapper = mount(OutlineList)
		await flushPromises()

		expect(wrapper.text()).toContain('First outline')
		expect(wrapper.text()).toContain(expectedDate)
		expect(wrapper.text()).toContain('Second outline')
		expect(wrapper.text()).toContain(new Date((mtime + 3600) * 1000).toLocaleString())
	})

	it('triggers create calls the API create function and emits open to open the new outline', async () => {
		listOutlines.mockResolvedValue([])
		createOutline.mockResolvedValue({ fileId: 42, name: '', etag: 'etag-1' })
		wrapper = mount(OutlineList)
		await flushPromises()

		await wrapper.get('button').trigger('click')
		await flushPromises()

		expect(createOutline).toHaveBeenCalledWith('')
		expect(wrapper.emitted('open')).toEqual([[42]])
	})
})
