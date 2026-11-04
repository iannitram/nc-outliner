import { showConfirmation, showError } from '@nextcloud/dialogs'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import {
	deleteOutline,
	downloadOutline,
	duplicateOutline,
	getSettings,
	listOutlines,
	renameOutline,
} from '../../src/api/outlines.js'

let beforeLeaveMock = vi.fn().mockResolvedValue(true)
const reloadMock = vi.fn()
const discardMock = vi.fn()

vi.mock('../../src/views/OutlineView.vue', () => ({
	default: {
		props: ['fileId'],
		emits: ['rename', 'duplicate', 'export', 'delete'],
		setup(props, { expose }) {
			expose({
				beforeLeave: () => beforeLeaveMock(),
				reload: () => reloadMock(),
				discard: () => discardMock(),
				getWorkingFile: () => ({ name: 'outline.opml', type: 'text/x-opml', data: '<opml />' }),
			})
			return {}
		},
		template: '<div class="outline-view">Outline {{ fileId }}</div>',
	},
}))

vi.mock('craft-bugreport-web', () => ({ ReportButton: {
	name: 'ReportButton',
	props: ['config', 'getWorkingFile'],
	template: '<button>Report a bug</button>',
} }))
vi.mock('@nextcloud/auth', () => ({ getRequestToken: () => 'test-csrf-token', getCurrentUser: () => null, onRequestTokenUpdate: () => {} }))
vi.mock('@nextcloud/initial-state', () => ({ loadState: () => ({ version: '0.1.0', commit: 'abcdef1', ncVersion: '33.0.10', configured: false }) }))
vi.mock('@nextcloud/dialogs', () => ({ showConfirmation: vi.fn(), showError: vi.fn(), showSuccess: vi.fn() }))
vi.mock('@nextcloud/vue', () => {
	const container = { template: '<div><slot /></div>' }
	const themeProvider = {
		props: ['dark', 'light'],
		template: '<div :data-theme-dark="dark || null" :data-theme-light="light || null"><slot /></div>',
	}
	const navigationNew = {
		props: ['text', 'disabled'],
		emits: ['click'],
		template: '<div class="app-navigation-new"><button :disabled="disabled" @click="$emit(\'click\')">{{ text }}</button></div>',
	}
	const navigationItem = {
		name: 'NcAppNavigationItem',
		props: ['name', 'active', 'href', 'editable', 'editLabel', 'editPlaceholder'],
		emits: ['click', 'update:name'],
		template: `
			<li class="app-navigation-entry" :class="{ active }" :data-editable="editable || null">
				<div class="entry-actions"><slot name="actions" /></div>
				<a class="app-navigation-entry-link" :href="href || '#'" @click="$emit('click', $event)">
					<span class="app-navigation-entry__name">{{ name }}</span>
				</a>
				<slot name="counter" />
				<slot name="extra" />
			</li>
		`,
	}
	const emptyContent = {
		props: ['name', 'description'],
		template: `
			<div class="empty-content">
				<h2>{{ name }}</h2>
				<p>{{ description }}</p>
				<slot name="icon" />
				<slot name="action" />
			</div>
		`,
	}
	return {
		NcContent: container,
		NcAppContent: container,
		NcAppNavigation: { template: '<div><slot /><footer><slot name="footer" /></footer></div>' },
		NcAppNavigationSettings: { props: ['name'], template: '<section :aria-label="name"><slot /></section>' },
		NcAppNavigationNew: navigationNew,
		NcAppNavigationItem: navigationItem,
		NcEmptyContent: emptyContent,
		NcButton: container,
		NcActionButton: { name: 'NcActionButton', emits: ['click'], template: '<button class="action" @click="$emit(\'click\')"><slot /></button>' },
		NcIconSvgWrapper: { props: ['path'], template: '<span />' },
		NcThemeProvider: themeProvider,
	}
})

vi.mock('../../src/api/outlines.js', () => ({
	createOutline: vi.fn(),
	deleteOutline: vi.fn(),
	downloadOutline: vi.fn(),
	duplicateOutline: vi.fn(),
	getSettings: vi.fn(),
	listOutlines: vi.fn(),
	renameOutline: vi.fn(),
	setSettings: vi.fn(),
}))

describe('App outline actions (#218, #219)', () => {
	const list = [
		{ fileId: 1, name: 'First.opml', mtime: 20 },
		{ fileId: 2, name: 'Second.opml', mtime: 10 },
	]

	beforeEach(() => {
		vi.clearAllMocks()
		localStorage.clear()
		beforeLeaveMock = vi.fn().mockResolvedValue(true)
		getSettings.mockResolvedValue({ theme: 'auto' })
		listOutlines.mockResolvedValue(list)
		window.location.hash = '#/outline/1'
	})

	afterEach(() => {
		window.location.hash = ''
	})

	/** @param {import('@vue/test-utils').VueWrapper} wrapper @param {number} index @param {string} label */
	async function clickAction(wrapper, index, label) {
		const entry = wrapper.findAll('.app-navigation-entry')[index]
		await entry.findAll('button.action').find((b) => b.text() === label).trigger('click')
		await flushPromises()
	}

	it('gives every sidebar entry Rename, Duplicate, Export and Delete', async () => {
		const wrapper = mount(App)
		await flushPromises()
		const entry = wrapper.findAll('.app-navigation-entry')[0]
		expect(entry.attributes('data-editable')).toBe('true')
		expect(entry.findAll('button.action').map((b) => b.text())).toEqual(['Duplicate', 'Export (.opml)', 'Delete'])
		wrapper.unmount()
	})

	it('renames the open outline from the sidebar, saving first and reloading it', async () => {
		renameOutline.mockResolvedValue({ fileId: 1, name: 'Trip.opml', etag: 'e' })
		const wrapper = mount(App)
		await flushPromises()
		wrapper.findAllComponents({ name: 'NcAppNavigationItem' })[0].vm.$emit('update:name', ' Trip ')
		await flushPromises()
		expect(beforeLeaveMock).toHaveBeenCalled()
		expect(renameOutline).toHaveBeenCalledWith(1, 'Trip')
		expect(reloadMock).toHaveBeenCalled()
		expect(listOutlines).toHaveBeenCalledTimes(2)
		wrapper.unmount()
	})

	it('renames from the top bar title', async () => {
		renameOutline.mockResolvedValue({ fileId: 1, name: 'Trip.opml', etag: 'e' })
		const wrapper = mount(App)
		await flushPromises()
		wrapper.getComponent('.outline-view').vm.$emit('rename', 'Trip')
		await flushPromises()
		expect(renameOutline).toHaveBeenCalledWith(1, 'Trip')
		wrapper.unmount()
	})

	it('does not rename to the same name, and shows the server reason for a bad one', async () => {
		const wrapper = mount(App)
		await flushPromises()
		wrapper.getComponent('.outline-view').vm.$emit('rename', 'First')
		await flushPromises()
		expect(renameOutline).not.toHaveBeenCalled()
		renameOutline.mockRejectedValue(Object.assign(new Error('Name contains forbidden characters'), { response: { status: 400 } }))
		wrapper.getComponent('.outline-view').vm.$emit('rename', 'a/b')
		await flushPromises()
		expect(showError).toHaveBeenCalledWith('Name contains forbidden characters')
		wrapper.unmount()
	})

	it('duplicates and exports a closed outline without touching the open one', async () => {
		duplicateOutline.mockResolvedValue({ fileId: 3, name: 'Second (copy).opml', etag: 'e' })
		const wrapper = mount(App)
		await flushPromises()
		await clickAction(wrapper, 1, 'Duplicate')
		expect(duplicateOutline).toHaveBeenCalledWith(2)
		await clickAction(wrapper, 1, 'Export (.opml)')
		expect(downloadOutline).toHaveBeenCalledWith(2, 'Second.opml')
		expect(beforeLeaveMock).not.toHaveBeenCalled()
		wrapper.unmount()
	})

	it('asks before deleting, and does nothing on Cancel', async () => {
		showConfirmation.mockResolvedValue(false)
		const wrapper = mount(App)
		await flushPromises()
		await clickAction(wrapper, 1, 'Delete')
		expect(showConfirmation).toHaveBeenCalledWith(expect.objectContaining({ labelConfirm: 'Delete' }))
		expect(deleteOutline).not.toHaveBeenCalled()
		wrapper.unmount()
	})

	it('deletes the open outline: saves, stops autosave, then opens the next one', async () => {
		showConfirmation.mockResolvedValue(true)
		const wrapper = mount(App)
		await flushPromises()
		listOutlines.mockResolvedValue([list[1]])
		await clickAction(wrapper, 0, 'Delete')
		expect(beforeLeaveMock).toHaveBeenCalled()
		expect(discardMock).toHaveBeenCalled()
		expect(deleteOutline).toHaveBeenCalledWith(1)
		expect(discardMock.mock.invocationCallOrder[0]).toBeLessThan(deleteOutline.mock.invocationCallOrder[0])
		expect(window.location.hash).toBe('#/outline/2')
		expect(wrapper.findAll('.app-navigation-entry')).toHaveLength(1)
		wrapper.unmount()
	})

	it('keeps the outline when its edits cannot be saved', async () => {
		showConfirmation.mockResolvedValue(true)
		beforeLeaveMock = vi.fn().mockResolvedValue(false)
		const wrapper = mount(App)
		await flushPromises()
		await clickAction(wrapper, 0, 'Delete')
		expect(deleteOutline).not.toHaveBeenCalled()
		expect(discardMock).not.toHaveBeenCalled()
		expect(showError).toHaveBeenCalled()
		wrapper.unmount()
	})
})
