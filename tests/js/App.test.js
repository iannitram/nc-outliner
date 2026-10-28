import { flushPromises, mount } from '@vue/test-utils'
import { ReportButton } from 'craft-bugreport-web'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import { getSettings, setSettings } from '../../src/api/outlines.js'

vi.mock('../../src/views/OutlineList.vue', () => ({ default: { template: '<div>My outlines view</div>' } }))
vi.mock('../../src/views/OutlineView.vue', () => ({ default: {
	props: ['fileId'],
	methods: {
		getWorkingFile: () => ({ name: 'outline.opml', type: 'text/x-opml', data: '<opml />' }),
	},
	template: '<div>Outline {{ fileId }}</div>',
} }))
vi.mock('craft-bugreport-web', () => ({ ReportButton: {
	name: 'ReportButton',
	props: ['config', 'getWorkingFile'],
	template: '<button>Report a bug</button>',
} }))
vi.mock('@nextcloud/auth', () => ({ getRequestToken: () => 'test-csrf-token' }))
vi.mock('@nextcloud/initial-state', () => ({ loadState: () => ({ version: '0.1.0', commit: 'abcdef1', ncVersion: '33.0.10', configured: false }) }))
vi.mock('@nextcloud/vue', () => {
	const container = { template: '<div><slot /></div>' }
	const themeProvider = {
		props: ['dark', 'light'],
		template: '<div :data-theme-dark="dark || null" :data-theme-light="light || null"><slot /></div>',
	}
	return {
		NcContent: container,
		NcAppContent: container,
		NcAppNavigation: container,
		NcButton: container,
		NcThemeProvider: themeProvider,
	}
})
vi.mock('../../src/api/outlines.js', () => ({
	getSettings: vi.fn(),
	setSettings: vi.fn(),
}))

describe('App', () => {
	it('mounts the report button with relay-only config and current working file', async () => {
		const wrapper = mount(App)
		await flushPromises()
		const button = wrapper.getComponent(ReportButton)
		const config = button.props('config')
		expect(config.relayUrl).toMatch(/\/apps\/nc_outliner\/api\/bugreport$/)
		expect(config.headers.requesttoken).toBe('test-csrf-token')
		expect(config).toMatchObject({ app: 'Outliner', version: '0.1.0', commit: 'abcdef1', ncVersion: '33.0.10' })
		expect(config).not.toHaveProperty('dropBase')
		expect(config).not.toHaveProperty('dropToken')
		expect(await button.props('getWorkingFile')()).toBeNull()
		expect(wrapper.text()).toContain('Bug reports are not set up for this app.')
		window.location.hash = '#/outline/42'
		window.dispatchEvent(new Event('hashchange'))
		await flushPromises()
		expect(await button.props('getWorkingFile')()).toEqual({ name: 'outline.opml', type: 'text/x-opml', data: '<opml />' })
		wrapper.unmount()
	})
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

		await wrapper.get('select[aria-label="Theme"]').setValue('dark')
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('dark')
		expect(wrapper.find('[data-theme-dark="true"]').exists()).toBe(true)

		await wrapper.get('select[aria-label="Theme"]').setValue('light')
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('light')
		expect(wrapper.find('[data-theme-light="true"]').exists()).toBe(true)

		await wrapper.get('select[aria-label="Theme"]').setValue('auto')
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
		expect(wrapper.get('select[aria-label="Theme"]').element.disabled).toBe(true)

		finishLoad({ theme: 'auto' })
		await flushPromises()

		expect(wrapper.get('select[aria-label="Theme"]').element.disabled).toBe(false)
		wrapper.unmount()
	})
})
