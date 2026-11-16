import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineView from '../../../src/views/OutlineView.vue'
import { readOutline, saveOutline } from '../../../src/api/outlines.js'

if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

vi.mock('../../../src/api/outlines.js', () => ({
	listOutlines: vi.fn(),
	readOutline: vi.fn(),
	saveCopy: vi.fn(),
	saveOutline: vi.fn(),
}))

vi.mock('../../../src/api/versions.js', () => ({
	listVersions: vi.fn().mockResolvedValue([]),
	readVersion: vi.fn(),
	restoreVersion: vi.fn(),
	nameVersion: vi.fn(),
}))

vi.mock('@nextcloud/dialogs', () => ({
	showSuccess: vi.fn(),
	showError: vi.fn(),
}))

describe('OutlineView flex column structure (#183)', () => {
	beforeEach(() => {
		readOutline.mockResolvedValue({
			fileId: 7,
			name: 'Project.opml',
			etag: 'etag-1',
			outline: {
				title: 'Project outline',
				rows: [
					{ id: 'r1', text: 'Section 1', note: '', collapsed: false, children: [] },
					{ id: 'r2', text: 'Section 2', note: '', collapsed: false, children: [] },
				],
				publishPath: null,
			},
		})
		saveOutline.mockResolvedValue({ ok: true, etag: 'etag-2' })
	})

	it('pins the status line as the last element child of the flex column view and uses OutlineEditor as the scroll container', async () => {
		const wrapper = mount(OutlineView, { props: { fileId: 7 } })
		await flushPromises()

		const view = wrapper.find('.outline-view')
		expect(view.exists()).toBe(true)
		expect(view.classes()).toContain('outline-view')

		const children = Array.from(view.element.children)
		const topBar = wrapper.findComponent({ name: 'OutlineTopBar' })
		const editor = wrapper.findComponent({ name: 'OutlineEditor' })
		const statusLine = wrapper.findComponent({ name: 'StatusLine' })

		expect(topBar.exists()).toBe(true)
		expect(editor.exists()).toBe(true)
		expect(statusLine.exists()).toBe(true)

		// Top bar is the first child of the view
		expect(children[0]).toBe(topBar.element)
		// Editor is positioned between the top bar and status line
		expect(children.indexOf(editor.element)).toBeGreaterThan(0)
		expect(children.indexOf(editor.element)).toBeLessThan(children.length - 1)
		// Status line is the last element child of the flex column view
		expect(children[children.length - 1]).toBe(statusLine.element)
		expect(view.element.lastElementChild).toBe(statusLine.element)

		// The editor area contains the rows tree; sorting lives in the ... menu (#189)
		expect(editor.classes()).toContain('outline-editor')
		expect(editor.find('.outline-sort').exists()).toBe(false)
		expect(editor.find('[role="tree"]').exists()).toBe(true)

		wrapper.unmount()
	})
})
