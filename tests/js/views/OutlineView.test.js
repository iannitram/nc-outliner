import { showSuccess } from '@nextcloud/dialogs'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineView from '../../../src/views/OutlineView.vue'
import { readOutline, saveCopy, saveOutline } from '../../../src/api/outlines.js'

vi.mock('@nextcloud/dialogs', () => ({
	showSuccess: vi.fn(),
	showError: vi.fn(),
}))

vi.mock('../../../src/api/outlines.js', () => ({
	readOutline: vi.fn(),
	saveCopy: vi.fn(),
	saveOutline: vi.fn(),
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

describe('OutlineView autosave conflict flow', () => {
	let wrapper

	beforeEach(() => {
		vi.useFakeTimers()
		showSuccess.mockClear()
		readOutline.mockResolvedValue({ fileId: 3, name: 'Plan.opml', etag: 'etag-1', outline: initialOutline })
		saveOutline.mockResolvedValue({ conflict: true, etag: 'etag-2' })
		saveCopy.mockResolvedValue({ fileId: 99, name: 'Plan (my copy).opml', etag: 'copy-etag' })
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
		document.body.innerHTML = ''
		vi.useRealTimers()
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' })
	})

	it('keeps the captured outline id for the copy and releases the dirty navigation barrier', async () => {
		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		await wrapper.get('button').trigger('click')
		await vi.advanceTimersByTimeAsync(1500)
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({ rows: [expect.objectContaining({ text: 'Edited' })] }), 'etag-1')
		expect(wrapper.text()).toContain('Changed elsewhere')
		const copyButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent.includes('Keep mine as a copy'))
		copyButton.click()
		await flushPromises()
		expect(saveCopy).toHaveBeenCalledWith(3, expect.objectContaining({ rows: [expect.objectContaining({ text: 'Edited' })] }))
		expect(window.location.hash).toBe('#/outline/99')
		await expect(wrapper.vm.beforeLeave()).resolves.toBe(true)
	})

	it('does not leave while the queued save cannot complete', async () => {
		saveOutline.mockRejectedValue(Error('offline'))
		wrapper = mount(OutlineView, { props: { fileId: 3 } })
		await flushPromises()
		await wrapper.get('button').trigger('click')
		await vi.advanceTimersByTimeAsync(1500)
		await expect(wrapper.vm.beforeLeave()).resolves.toBe(false)
		await expect(readOutline).toHaveBeenCalledTimes(1)
	})

	it('creates the first row through history when the server returns an empty outline', async () => {
		readOutline.mockResolvedValue({
			fileId: 3,
			name: 'Blank.opml',
			etag: 'etag-1',
			outline: { title: 'Blank', rows: [], publishPath: null },
		})
		wrapper = mount(OutlineView, { props: { fileId: 3 } })
		await flushPromises()
		await wrapper.get('button').trigger('click')
		await vi.advanceTimersByTimeAsync(1500)
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({
			rows: [expect.objectContaining({ text: '', children: [] })],
		}), 'etag-1')
	})

	it('shows a success toast after keepCopy succeeds', async () => {
		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		await wrapper.get('button').trigger('click')
		await vi.advanceTimersByTimeAsync(1500)
		const copyButton = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent.includes('Keep mine as a copy'))
		copyButton.click()
		await flushPromises()
		expect(showSuccess).toHaveBeenCalledTimes(1)
		expect(showSuccess).toHaveBeenCalledWith('Saved as Plan (my copy).opml')
	})

	it('flushes pending save on window pagehide without waiting for autosave delay', async () => {
		saveOutline.mockResolvedValue({ ok: true, etag: 'etag-2' })
		wrapper = mount(OutlineView, { props: { fileId: 3 } })
		await flushPromises()
		await wrapper.get('button').trigger('click')
		expect(saveOutline).not.toHaveBeenCalled()
		window.dispatchEvent(new Event('pagehide'))
		await flushPromises()
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({
			rows: [expect.objectContaining({ text: 'Edited' })],
		}), 'etag-1')
	})

	it('flushes pending save on visibilitychange when document becomes hidden', async () => {
		saveOutline.mockResolvedValue({ ok: true, etag: 'etag-2' })
		wrapper = mount(OutlineView, { props: { fileId: 3 } })
		await flushPromises()
		await wrapper.get('button').trigger('click')
		expect(saveOutline).not.toHaveBeenCalled()
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
		document.dispatchEvent(new Event('visibilitychange'))
		await flushPromises()
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({
			rows: [expect.objectContaining({ text: 'Edited' })],
		}), 'etag-1')
	})
})
