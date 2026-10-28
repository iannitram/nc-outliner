import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import { createOutline, getSettings, listOutlines, setSettings } from '../../src/api/outlines.js'

let beforeLeaveMock = vi.fn().mockResolvedValue(true)

vi.mock('../../src/views/OutlineView.vue', () => ({
	default: {
		props: ['fileId'],
		setup(props, { expose }) {
			expose({
				beforeLeave: () => beforeLeaveMock(),
			})
			return {}
		},
		template: '<div class="outline-view">Outline {{ fileId }}</div>',
	},
}))

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
		props: ['name', 'active', 'href'],
		emits: ['click'],
		template: `
			<li class="app-navigation-entry" :class="{ active }">
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
		NcThemeProvider: themeProvider,
	}
})

vi.mock('../../src/api/outlines.js', () => ({
	createOutline: vi.fn(),
	getSettings: vi.fn(),
	listOutlines: vi.fn(),
	setSettings: vi.fn(),
}))

describe('App', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		localStorage.clear()
		beforeLeaveMock = vi.fn().mockResolvedValue(true)
		getSettings.mockResolvedValue({ theme: 'auto' })
		setSettings.mockImplementation(async (theme) => ({ theme }))
		listOutlines.mockResolvedValue([])
		createOutline.mockResolvedValue({ fileId: 42, name: '', etag: 'etag-1' })
	})

	afterEach(() => {
		window.location.hash = ''
		localStorage.clear()
	})

	it('renders outlines in the navigation newest first, with the open item active and .opml stripped', async () => {
		const nowSeconds = Math.floor(Date.now() / 1000)
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'Older outline.opml', mtime: nowSeconds - 3600 },
			{ fileId: 2, name: 'Newer outline.OPML', mtime: nowSeconds },
		])
		window.location.hash = '#/outline/2'
		const wrapper = mount(App)
		await flushPromises()

		const items = wrapper.findAll('.app-navigation-entry')
		expect(items).toHaveLength(2)
		expect(items[0].text()).toContain('Newer outline')
		expect(items[0].text()).not.toContain('.OPML')
		expect(items[0].classes()).toContain('active')
		expect(items[0].get('a').attributes('href')).toBe('#/outline/2')

		expect(items[1].text()).toContain('Older outline')
		expect(items[1].text()).not.toContain('.opml')
		expect(items[1].classes()).not.toContain('active')
		expect(items[1].get('a').attributes('href')).toBe('#/outline/1')
		expect(wrapper.find('footer [aria-label="Outliner settings"] input[value="auto"]').exists()).toBe(true)
		wrapper.unmount()
	})

	it('strips trailing .opml extension in navigation entry names', async () => {
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'Community garden plan.opml', mtime: 100 },
			{ fileId: 2, name: 'Trip plan.OPML', mtime: 200 },
			{ fileId: 3, name: 'Untitled.opml', mtime: 300 },
		])
		window.location.hash = '#/outline/1'
		const wrapper = mount(App)
		await flushPromises()

		const items = wrapper.findAll('.app-navigation-entry')
		expect(items[0].text()).toContain('Untitled')
		expect(items[0].text()).not.toContain('.opml')
		expect(items[1].text()).toContain('Trip plan')
		expect(items[1].text()).not.toContain('.OPML')
		expect(items[2].text()).toContain('Community garden plan')
		expect(items[2].text()).not.toContain('.opml')
		wrapper.unmount()
	})

	it('clicking an entry sets the hash to #/outline/<id>, and beforeLeave() is called first', async () => {
		const mtime = 1700000000
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'First outline', mtime },
			{ fileId: 2, name: 'Second outline', mtime: mtime + 3600 },
		])
		window.location.hash = '#/outline/2'
		const wrapper = mount(App)
		await flushPromises()

		let leaveCalledBeforeHashChange = false
		beforeLeaveMock = vi.fn().mockImplementation(async () => {
			if (window.location.hash === '#/outline/2') {
				leaveCalledBeforeHashChange = true
			}
			return true
		})

		const items = wrapper.findAll('.app-navigation-entry')
		expect(items[1].get('a').attributes('href')).toBe('#/outline/1')

		await items[1].get('a').trigger('click')
		await flushPromises()

		expect(beforeLeaveMock).toHaveBeenCalled()
		expect(leaveCalledBeforeHashChange).toBe(true)
		expect(window.location.hash).toBe('#/outline/1')
		expect(wrapper.text()).toContain('Outline 1')
		expect(localStorage.getItem('nc_outliner_last_outline')).toBe('1')
		wrapper.unmount()
	})

	it('cancels switch and preserves current hash if beforeLeave returns false', async () => {
		const mtime = 1700000000
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'First outline', mtime },
			{ fileId: 2, name: 'Second outline', mtime: mtime + 3600 },
		])
		window.location.hash = '#/outline/2'
		const wrapper = mount(App)
		await flushPromises()

		beforeLeaveMock = vi.fn().mockResolvedValue(false)

		const items = wrapper.findAll('.app-navigation-entry')
		await items[1].get('a').trigger('click')
		await flushPromises()

		expect(beforeLeaveMock).toHaveBeenCalled()
		expect(window.location.hash).toBe('#/outline/2')
		expect(wrapper.text()).toContain('Outline 2')
		wrapper.unmount()
	})

	it('with outlines present and an empty hash, the newest outline opens', async () => {
		window.location.hash = ''
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'Older outline', mtime: 100 },
			{ fileId: 2, name: 'Newer outline', mtime: 200 },
		])
		const wrapper = mount(App)
		await flushPromises()

		expect(window.location.hash).toBe('#/outline/2')
		expect(wrapper.text()).toContain('Outline 2')
		expect(wrapper.text()).not.toContain('No outlines yet')
		expect(localStorage.getItem('nc_outliner_last_outline')).toBe('2')
		wrapper.unmount()
	})

	it('with outlines present and an empty hash, the last-opened outline opens', async () => {
		window.location.hash = ''
		localStorage.setItem('nc_outliner_last_outline', '1')
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'First outline', mtime: 100 },
			{ fileId: 2, name: 'Second outline', mtime: 200 },
		])
		const wrapper = mount(App)
		await flushPromises()

		expect(window.location.hash).toBe('#/outline/1')
		expect(wrapper.text()).toContain('Outline 1')
		expect(wrapper.text()).not.toContain('No outlines yet')
		wrapper.unmount()
	})

	it('with outlines present and an unknown hash, opens the last-opened outline else newest', async () => {
		window.location.hash = '#/outline/999'
		localStorage.setItem('nc_outliner_last_outline', '1')
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'First outline', mtime: 100 },
			{ fileId: 2, name: 'Second outline', mtime: 200 },
		])
		const wrapper = mount(App)
		await flushPromises()

		expect(window.location.hash).toBe('#/outline/1')
		expect(wrapper.text()).toContain('Outline 1')
		expect(wrapper.text()).not.toContain('No outlines yet')
		wrapper.unmount()
	})

	it('with outlines present, navigating to an empty hash restores the outline and never shows empty state', async () => {
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'First outline', mtime: 100 },
			{ fileId: 2, name: 'Second outline', mtime: 200 },
		])
		window.location.hash = '#/outline/1'
		const wrapper = mount(App)
		await flushPromises()

		expect(wrapper.text()).toContain('Outline 1')

		// Simulate external hashchange to empty string
		window.location.hash = ''
		window.dispatchEvent(new HashChangeEvent('hashchange'))
		await flushPromises()

		expect(wrapper.text()).not.toContain('No outlines yet')
		expect(wrapper.text()).toContain('Outline 1')
		expect(window.location.hash).toBe('#/outline/1')
		wrapper.unmount()
	})

	it('the empty state shows only with zero outlines', async () => {
		listOutlines.mockResolvedValue([])
		localStorage.setItem('nc_outliner_last_outline', '1')
		const wrapper = mount(App)
		await flushPromises()

		expect(window.location.hash).toBe('')
		expect(wrapper.text()).toContain('No outlines yet')
		expect(wrapper.findAll('.app-navigation-entry')).toHaveLength(0)
		wrapper.unmount()
	})

	it('falls back to the newest outline if localStorage throws on read', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementationOnce(() => {
			throw new Error('SecurityError: access denied')
		})
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'Older outline', mtime: 100 },
			{ fileId: 2, name: 'Newer outline', mtime: 200 },
		])
		const wrapper = mount(App)
		await flushPromises()

		expect(window.location.hash).toBe('#/outline/2')
		expect(wrapper.text()).toContain('Outline 2')
		wrapper.unmount()
	})

	it('does not crash if localStorage throws on write', async () => {
		vi.spyOn(Storage.prototype, 'setItem').mockImplementationOnce(() => {
			throw new Error('QuotaExceededError')
		})
		listOutlines.mockResolvedValue([
			{ fileId: 2, name: 'Newer outline', mtime: 200 },
		])
		const wrapper = mount(App)
		await flushPromises()

		expect(wrapper.text()).toContain('Outline 2')
		wrapper.unmount()
	})

	it('creates a new outline when New outline button is clicked in navigation', async () => {
		listOutlines.mockResolvedValue([])
		createOutline.mockResolvedValue({ fileId: 42, name: '', etag: 'etag-1' })
		const wrapper = mount(App)
		await flushPromises()

		listOutlines.mockResolvedValue([{ fileId: 42, name: '', mtime: 100 }])
		await wrapper.get('.app-navigation-new button').trigger('click')
		await flushPromises()

		expect(createOutline).toHaveBeenCalledWith('')
		expect(window.location.hash).toBe('#/outline/42')
		expect(localStorage.getItem('nc_outliner_last_outline')).toBe('42')
		wrapper.unmount()
	})

	it('displays relative edited time in navigation item extra slot', async () => {
		const nowSeconds = Math.floor(Date.now() / 1000)
		listOutlines.mockResolvedValue([
			{ fileId: 1, name: 'Outline 1', mtime: nowSeconds - 10 },
			{ fileId: 2, name: 'Outline 2', mtime: nowSeconds - 300 },
		])
		window.location.hash = '#/outline/1'
		const wrapper = mount(App)
		await flushPromises()

		const dates = wrapper.findAll('.outline-entry-date')
		expect(dates[0].text()).toBe('Edited just now')
		expect(dates[1].text()).toBe('Edited 5 min ago')
		wrapper.unmount()
	})

	it('mounts the dialog host in a body-level theme provider, outside the app', async () => {
		document.getElementById('nc-outliner-dialogs')?.remove()
		const mountPoint = document.createElement('div')
		mountPoint.id = 'content'
		document.body.append(mountPoint)
		getSettings.mockResolvedValueOnce({ theme: 'dark' })
		const wrapper = mount(App, { attachTo: mountPoint })
		await flushPromises()

		const host = document.body.querySelector('#nc-outliner-dialogs')
		const provider = host.parentElement
		expect(provider.parentElement).toBe(document.body)
		expect(provider.hasAttribute('data-theme-dark')).toBe(true)
		expect(mountPoint.contains(host)).toBe(false)
		expect(host.closest('#content')).toBeNull()
		wrapper.unmount()
		mountPoint.remove()
	})

	it('follows Nextcloud for Auto by setting neither dark nor light theme attribute', async () => {
		getSettings.mockResolvedValueOnce({ theme: 'auto' })
		const wrapper = mount(App)
		await flushPromises()

		expect(wrapper.find('[data-theme-dark]').exists()).toBe(false)
		expect(wrapper.find('[data-theme-light]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('applies the forced dark theme when theme is dark', async () => {
		getSettings.mockResolvedValueOnce({ theme: 'dark' })
		const wrapper = mount(App)
		await flushPromises()

		expect(wrapper.find('[data-theme-dark="true"]').exists()).toBe(true)
		expect(wrapper.find('[data-theme-light]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('applies the forced light theme when theme is light', async () => {
		getSettings.mockResolvedValueOnce({ theme: 'light' })
		const wrapper = mount(App)
		await flushPromises()

		expect(wrapper.find('[data-theme-light="true"]').exists()).toBe(true)
		expect(wrapper.find('[data-theme-dark]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('updates the forced theme and persists when user changes selection', async () => {
		getSettings.mockResolvedValueOnce({ theme: 'auto' })
		const wrapper = mount(App)
		await flushPromises()

		expect(wrapper.find('[data-theme-dark]').exists()).toBe(false)
		expect(wrapper.find('[data-theme-light]').exists()).toBe(false)

		await wrapper.get('input[value="dark"]').setValue()
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('dark')
		expect(wrapper.find('[data-theme-dark="true"]').exists()).toBe(true)

		await wrapper.get('input[value="light"]').setValue()
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('light')
		expect(wrapper.find('[data-theme-light="true"]').exists()).toBe(true)

		await wrapper.get('input[value="auto"]').setValue()
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('auto')
		expect(wrapper.find('[data-theme-dark]').exists()).toBe(false)
		expect(wrapper.find('[data-theme-light]').exists()).toBe(false)
		wrapper.unmount()
	})

	it('keeps the theme control disabled while settings are loading', async () => {
		let finishLoad
		getSettings.mockReturnValueOnce(new Promise((resolve) => {
			finishLoad = resolve
		}))

		const wrapper = mount(App)
		expect(wrapper.get('input[value="auto"]').element.disabled).toBe(true)

		finishLoad({ theme: 'auto' })
		await flushPromises()

		expect(wrapper.get('input[value="auto"]').element.disabled).toBe(false)
		wrapper.unmount()
	})
})
