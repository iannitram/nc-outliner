import { showSuccess } from '@nextcloud/dialogs'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineView from '../../../src/views/OutlineView.vue'
import { exportOpml, listOutlines, readOutline, saveCopy, saveOutline } from '../../../src/api/outlines.js'
import { listVersions, restoreVersion } from '../../../src/api/versions.js'

vi.mock('@nextcloud/dialogs', () => ({
	showSuccess: vi.fn(),
	showError: vi.fn(),
}))

vi.mock('../../../src/api/outlines.js', () => ({
	exportOpml: vi.fn(),
	listOutlines: vi.fn(),
	readOutline: vi.fn(),
	saveCopy: vi.fn(),
	saveOutline: vi.fn(),
}))

vi.mock('../../../src/api/versions.js', () => ({
	listVersions: vi.fn(),
	readVersion: vi.fn(),
	restoreVersion: vi.fn(),
	nameVersion: vi.fn(),
}))

/**
 * @param {import('@vue/test-utils').VueWrapper} wrapper mounted view
 * @param {string} text the button's text
 * @return {import('@vue/test-utils').DOMWrapper} the button
 */
function buttonLabelled(wrapper, text) {
	return wrapper.findAll('button').find((button) => button.text() === text)
}

const scheduleSpy = vi.fn()
vi.mock('../../../src/editor/saver.js', async (importOriginal) => {
	const actual = await importOriginal()
	return {
		...actual,
		createSaver: (...args) => {
			const saver = actual.createSaver(...args)
			const schedule = saver.schedule.bind(saver)
			saver.schedule = (doc) => {
				scheduleSpy(doc)
				return schedule(doc)
			}
			return saver
		},
	}
})

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

vi.mock('../../../src/components/PublishButton.vue', () => ({
	default: {
		name: 'PublishButton',
		props: ['fileId', 'publishPath', 'name', 'title'],
		emits: ['published'],
		template: '<div class="publish-button-stub" />',
	},
}))

const initialOutline = {
	title: 'Plan',
	rows: [{ id: 'r1', text: 'First', note: '', collapsed: false, children: [] }],
	publishPath: null,
}

describe('OutlineView autosave conflict flow', () => {
	it('exports the current unsaved outline through the OPML writer', async () => {
		exportOpml.mockResolvedValue('<opml>current edits</opml>')
		const wrapper = mount(OutlineView, { props: { fileId: 42 } })
		expect(await wrapper.vm.getWorkingFile()).toBeNull()
		await flushPromises()
		await buttonLabelled(wrapper, 'Edit outline').trigger('click')
		await flushPromises()
		const file = await wrapper.vm.getWorkingFile()
		expect(file).toEqual({ name: 'outline.opml', type: 'text/x-opml', data: '<opml>current edits</opml>' })
		expect(exportOpml).toHaveBeenCalledWith(expect.objectContaining({ rows: [expect.objectContaining({ text: 'Edited' })] }))
		wrapper.unmount()
	})
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
		await buttonLabelled(wrapper, 'Edit outline').trigger('click')
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
		await buttonLabelled(wrapper, 'Edit outline').trigger('click')
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
		await buttonLabelled(wrapper, 'Add first row').trigger('click')
		await vi.advanceTimersByTimeAsync(1500)
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({
			rows: [expect.objectContaining({ text: '', children: [] })],
		}), 'etag-1')
	})

	it('shows a success toast after keepCopy succeeds', async () => {
		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		await buttonLabelled(wrapper, 'Edit outline').trigger('click')
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
		await buttonLabelled(wrapper, 'Edit outline').trigger('click')
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
		await buttonLabelled(wrapper, 'Edit outline').trigger('click')
		expect(saveOutline).not.toHaveBeenCalled()
		Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' })
		document.dispatchEvent(new Event('visibilitychange'))
		await flushPromises()
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({
			rows: [expect.objectContaining({ text: 'Edited' })],
		}), 'etag-1')
	})

	it('restores a version through the view: the outline reloads with its new etag, and that etag is used for the next save', async () => {
		listVersions.mockResolvedValue([
			{ id: '300', time: Date.parse('2026-10-28T17:51:38Z'), label: '', size: 3 },
			{ id: '100', time: Date.parse('2026-10-28T17:51:02Z'), label: '', size: 3 },
		])
		listOutlines.mockResolvedValue([{ fileId: 3, name: 'Untitled', mtime: Date.parse('2026-10-28T17:51:38Z') / 1000 }])
		restoreVersion.mockResolvedValue()
		saveOutline.mockResolvedValue({ ok: true, etag: 'etag-4' })
		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		readOutline.mockResolvedValueOnce({ fileId: 3, name: 'Plan.opml', etag: 'etag-3', outline: initialOutline })

		await buttonLabelled(wrapper, 'Versions').trigger('click')
		await flushPromises()
		const restore = Array.from(document.body.querySelectorAll('button')).find((button) => button.textContent.trim() === 'Restore')
		restore.click()
		await flushPromises()

		expect(restoreVersion).toHaveBeenCalledWith(3, '100')
		expect(readOutline).toHaveBeenCalledTimes(2)
		await buttonLabelled(wrapper, 'Edit outline').trigger('click')
		await vi.advanceTimersByTimeAsync(1500)
		expect(saveOutline).toHaveBeenCalledWith(3, expect.anything(), 'etag-3')
	})

	it('saves outline when PublishButton emits a new publishPath', async () => {
		saveOutline.mockResolvedValue({ ok: true, etag: 'etag-2' })
		wrapper = mount(OutlineView, { props: { fileId: 3 } })
		await flushPromises()
		const publishBtn = wrapper.findComponent({ name: 'PublishButton' })
		publishBtn.vm.$emit('published', '/Documents/Plan.odt')
		await vi.advanceTimersByTimeAsync(1500)
		expect(saveOutline).toHaveBeenCalledWith(3, expect.objectContaining({
			publishPath: '/Documents/Plan.odt',
		}), 'etag-1')
	})

	it('schedules exactly one save per publish', async () => {
		saveOutline.mockResolvedValue({ ok: true, etag: 'etag-2' })
		wrapper = mount(OutlineView, { props: { fileId: 3 } })
		await flushPromises()
		scheduleSpy.mockClear()
		const publishBtn = wrapper.findComponent({ name: 'PublishButton' })
		publishBtn.vm.$emit('published', '/Documents/Plan.odt')
		await flushPromises()
		expect(scheduleSpy).toHaveBeenCalledTimes(1)
		expect(scheduleSpy).toHaveBeenCalledWith(expect.objectContaining({ publishPath: '/Documents/Plan.odt' }))
	})
})
