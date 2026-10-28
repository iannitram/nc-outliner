import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import { getSettings, setSettings } from '../../src/api/outlines.js'

vi.mock('../../src/views/OutlineList.vue', () => ({ default: { template: '<div>My outlines view</div>' } }))
vi.mock('../../src/views/OutlineView.vue', () => ({ default: { props: ['fileId'], template: '<div>Outline {{ fileId }}</div>' } }))
vi.mock('@nextcloud/vue', () => {
	const container = { template: '<div><slot /></div>' }
	const themeProvider = {
		props: ['dark', 'light'],
		template: '<div :data-theme-dark="dark || null" :data-theme-light="light || null"><slot /></div>',
	}
	return {
		NcContent: container,
		NcAppContent: container,
		NcAppNavigation: { template: '<div><slot /><footer><slot name="footer" /></footer></div>' },
		NcAppNavigationSettings: { props: ['name'], template: '<section :aria-label="name"><slot /></section>' },
		NcButton: container,
		NcThemeProvider: themeProvider,
	}
})
vi.mock('../../src/api/outlines.js', () => ({
	getSettings: vi.fn(),
	setSettings: vi.fn(),
}))

describe('App', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		getSettings.mockResolvedValue({ theme: 'auto' })
		setSettings.mockImplementation(async (theme) => ({ theme }))
	})

	afterEach(() => {
		window.location.hash = ''
	})

	it('shows the outline list by default and follows the outline hash', async () => {
		const wrapper = mount(App)
		await flushPromises()
		expect(wrapper.text()).toContain('My outlines view')
		expect(wrapper.find('footer [aria-label="Outliner settings"] input[value="auto"]').exists()).toBe(true)
		window.location.hash = '#/outline/42'
		window.dispatchEvent(new Event('hashchange'))
		await flushPromises()
		expect(wrapper.text()).toContain('Outline 42')
		wrapper.unmount()
	})

	it('mounts the dialog host in a body-level theme provider, outside the app', async () => {
		// Drop the setup host so only the one App renders is found.
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
