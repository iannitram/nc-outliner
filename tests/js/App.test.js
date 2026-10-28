import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import App from '../../src/App.vue'

vi.mock('../../src/views/OutlineList.vue', () => ({ default: { template: '<div>My outlines view</div>' } }))
vi.mock('../../src/views/OutlineView.vue', () => ({ default: { props: ['fileId'], template: '<div>Outline {{ fileId }}</div>' } }))
vi.mock('@nextcloud/vue', () => {
	const container = { template: '<div><slot /></div>' }
	return { NcContent: container, NcAppContent: container, NcAppNavigation: container, NcButton: container }
})

describe('App', () => {
	afterEach(() => {
		window.location.hash = ''
	})

	it('shows the outline list by default and follows the outline hash', async () => {
		const wrapper = mount(App)
		expect(wrapper.text()).toContain('My outlines view')
		window.location.hash = '#/outline/42'
		window.dispatchEvent(new Event('hashchange'))
		await wrapper.vm.$nextTick()
		expect(wrapper.text()).toContain('Outline 42')
		wrapper.unmount()
	})
})
