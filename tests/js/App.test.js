import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'
import { getSettings, setSettings } from '../../src/api/outlines.js'

vi.mock('../../src/api/outlines.js', () => ({
	getSettings: vi.fn().mockResolvedValue({ theme: 'auto' }),
	setSettings: vi.fn().mockImplementation(async (theme) => ({ theme })),
}))

vi.mock('../../src/views/OutlineList.vue', () => ({ default: { template: '<div>My outlines view</div>' } }))
vi.mock('../../src/views/OutlineView.vue', () => ({ default: { props: ['fileId'], template: '<div>Outline {{ fileId }}</div>' } }))
vi.mock('@nextcloud/vue', () => {
	const container = { template: '<div><slot /></div>' }
	const themeProvider = {
		props: ['dark', 'light'],
		template: '<div :data-theme-dark="dark || null" :data-theme-light="light || null"><slot /></div>',
	}
	return { NcContent: container, NcAppContent: container, NcAppNavigation: container, NcButton: container, NcThemeProvider: themeProvider }
})

describe('App', () => {
	afterEach(() => {
		window.location.hash = ''
	})

	it('shows the outline list by default and follows the outline hash', async () => {
		const wrapper = mount(App)
		await flushPromises()
		expect(wrapper.text()).toContain('My outlines view')
		window.location.hash = '#/outline/42'
		window.dispatchEvent(new Event('hashchange'))
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Outline 42')
		wrapper.unmount()
	})

	it('loads the saved theme override and persists a changed selection', async () => {
		getSettings.mockResolvedValueOnce({ theme: 'dark' })
		const wrapper = mount(App)
		await flushPromises()
		expect(wrapper.find('[data-theme-dark="true"]').exists()).toBe(true)
		await wrapper.get('select[aria-label="Theme"]').setValue('light')
		await flushPromises()
		expect(setSettings).toHaveBeenCalledWith('light')
		expect(wrapper.find('[data-theme-light="true"]').exists()).toBe(true)
		wrapper.unmount()
	})
})
