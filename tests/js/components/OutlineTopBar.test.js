import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeAll, describe, expect, it } from 'vitest'
import OutlineTopBar from '../../../src/components/OutlineTopBar.vue'

let resizeCallback = null

class MockResizeObserver {
	constructor(cb) {
		resizeCallback = cb
		this.cb = cb
	}

	observe(element) {
		this.element = element
	}

	unobserve() {}

	disconnect() {}
}

beforeAll(() => {
	globalThis.ResizeObserver = MockResizeObserver
})

describe('OutlineTopBar.vue', () => {
	afterEach(() => {
		resizeCallback = null
	})

	it('renders title on one line with ellipsis and title attribute', () => {
		const wrapper = mount(OutlineTopBar, {
			props: {
				title: 'Community garden plan',
				fileId: 42,
			},
		})
		const titleEl = wrapper.get('h1.title')
		expect(titleEl.text()).toBe('Community garden plan')
		expect(titleEl.attributes('title')).toBe('Community garden plan')
	})

	it('leaves room for the navigation toggle with a spacer', () => {
		const wrapper = mount(OutlineTopBar, {
			props: {
				title: 'Community garden plan',
				fileId: 42,
			},
		})
		expect(wrapper.find('.nav-toggle-spacer').exists()).toBe(true)
	})

	it('renders the Versions icon button and emits openVersions on click', async () => {
		const wrapper = mount(OutlineTopBar, {
			props: {
				title: 'Community garden plan',
				fileId: 42,
			},
		})
		const versionsBtn = wrapper.findAll('button').find((btn) => btn.attributes('aria-label') === 'Versions')
		expect(versionsBtn).toBeDefined()
		expect(versionsBtn.attributes('title')).toBe('Versions')

		await versionsBtn.trigger('click')
		expect(wrapper.emitted('openVersions')).toHaveLength(1)
	})

	it('renders NcActions 3-dot menu with Versions item that emits openVersions', async () => {
		const wrapper = mount(OutlineTopBar, {
			props: {
				title: 'Community garden plan',
				fileId: 42,
			},
		})
		const ncActions = wrapper.findComponent({ name: 'NcActions' })
		expect(ncActions.exists()).toBe(true)
		expect(ncActions.props('forceMenu')).toBe(true)
		const toggleBtn = ncActions.find('button')
		expect(toggleBtn.exists()).toBe(true)
		await toggleBtn.trigger('click')
		await flushPromises()

		const ncActionButton = wrapper.findComponent({ name: 'NcActionButton' })
		if (ncActionButton.exists()) {
			expect(ncActionButton.text()).toContain('Versions')
			await ncActionButton.trigger('click')
			expect(wrapper.emitted('openVersions')).toHaveLength(1)
		}
	})

	it('puts "Sort rows…" and "Versions" in the ... menu and emits openSort and openVersions', async () => {
		// The real popover renders its items lazily in a teleport, so show the slot in place.
		const wrapper = mount(OutlineTopBar, {
			props: { title: 'Community garden plan', fileId: 42 },
			global: {
				stubs: { NcActions: { template: '<div class="actions-stub"><slot /></div>' } },
			},
		})
		const entries = wrapper.findAllComponents({ name: 'NcActionButton' })
		expect(entries.map((entry) => entry.text())).toEqual(['Sort rows…', 'Versions'])
		await entries[0].find('button').trigger('click')
		expect(wrapper.emitted('openSort')).toHaveLength(1)
		await entries[1].find('button').trigger('click')
		expect(wrapper.emitted('openVersions')).toHaveLength(1)
	})

	it('renders PublishButton and forwards published event', async () => {
		const wrapper = mount(OutlineTopBar, {
			props: {
				title: 'Community garden plan',
				fileId: 42,
				publishPath: '/Documents/Garden.odt',
			},
		})
		const publishBtnComponent = wrapper.findComponent({ name: 'PublishButton' })
		expect(publishBtnComponent.exists()).toBe(true)
		expect(publishBtnComponent.props('fileId')).toBe(42)
		expect(publishBtnComponent.props('publishPath')).toBe('/Documents/Garden.odt')

		publishBtnComponent.vm.$emit('published', '/Documents/Garden.odt')
		expect(wrapper.emitted('published')).toEqual([['/Documents/Garden.odt']])
	})

	describe('Publish icon mode under 760 px', () => {
		it('renders Publish in full label mode when width is at 1280 px or 1024 px', async () => {
			const wrapper = mount(OutlineTopBar, {
				props: {
					title: 'Community garden plan',
					fileId: 42,
				},
				attachTo: document.body,
			})
			await flushPromises()

			// Simulate width >= 760 px
			resizeCallback?.([{ contentRect: { width: 1280 }, target: wrapper.element }])
			await flushPromises()

			const publishBtnComponent = wrapper.findComponent({ name: 'PublishButton' })
			expect(publishBtnComponent.props('iconOnly')).toBe(false)
			expect(wrapper.get('.publish-button-text').text()).toBe('Publish to Doc')
			wrapper.unmount()
		})

		it('switches Publish to icon mode with tooltip when width is under 760 px (e.g. 700 px or 390 px)', async () => {
			const wrapper = mount(OutlineTopBar, {
				props: {
					title: 'Community garden plan',
					fileId: 42,
				},
				attachTo: document.body,
			})
			await flushPromises()

			// Simulate content width of 700 px (as in mockup G / 1024 px window with nav open)
			resizeCallback?.([{ contentRect: { width: 700 }, target: wrapper.element }])
			await flushPromises()

			const publishBtnComponent = wrapper.findComponent({ name: 'PublishButton' })
			expect(publishBtnComponent.props('iconOnly')).toBe(true)
			expect(wrapper.find('.publish-button-text').exists()).toBe(false)

			const publishBtn = publishBtnComponent.get('button')
			expect(publishBtn.attributes('title')).toBe('Publish to Doc')
			expect(publishBtn.attributes('aria-label')).toBe('Publish to Doc')
			expect(publishBtn.find('.publish-icon').exists()).toBe(true)

			// Simulate phone width of 390 px
			resizeCallback?.([{ contentRect: { width: 390 }, target: wrapper.element }])
			await flushPromises()
			expect(publishBtnComponent.props('iconOnly')).toBe(true)
			expect(wrapper.find('.publish-button-text').exists()).toBe(false)
			wrapper.unmount()
		})

		it('respects isNarrow prop override if specified', () => {
			const wrapper = mount(OutlineTopBar, {
				props: {
					title: 'Community garden plan',
					fileId: 42,
					isNarrow: true,
				},
			})
			const publishBtnComponent = wrapper.findComponent({ name: 'PublishButton' })
			expect(publishBtnComponent.props('iconOnly')).toBe(true)
			expect(wrapper.find('.publish-button-text').exists()).toBe(false)
		})
	})
})
