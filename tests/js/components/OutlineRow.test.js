import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import OutlineRow from '../../../src/components/OutlineRow.vue'

describe('OutlineRow', () => {
	let wrapper

	afterEach(() => {
		if (wrapper) {
			wrapper.unmount()
			wrapper = null
		}
	})

	it('renders row text in an input and exposes focus method', () => {
		const row = { id: 'r1', text: 'Sample text', note: '', collapsed: false, children: [] }
		wrapper = mount(OutlineRow, {
			props: { row },
			attachTo: document.body,
		})

		const input = wrapper.find('input')
		expect(input.element.value).toBe('Sample text')

		wrapper.vm.focus('end')
		expect(document.activeElement).toBe(input.element)
		expect(input.element.selectionStart).toBe('Sample text'.length)
		expect(input.element.selectionEnd).toBe('Sample text'.length)

		wrapper.vm.focus('start')
		expect(input.element.selectionStart).toBe(0)
		expect(input.element.selectionEnd).toBe(0)
	})

	it('emits input-text on input', async () => {
		const row = { id: 'r1', text: 'Sample', note: '', collapsed: false, children: [] }
		wrapper = mount(OutlineRow, {
			props: { row },
		})

		const input = wrapper.find('input')
		await input.setValue('Modified')

		expect(wrapper.emitted('input-text')).toBeTruthy()
		expect(wrapper.emitted('input-text')[0][0]).toBe('r1')
		expect(wrapper.emitted('input-text')[0][1]).toBe('Modified')
	})

	it('emits row-keydown on keydown', async () => {
		const row = { id: 'r1', text: 'Sample', note: '', collapsed: false, children: [] }
		wrapper = mount(OutlineRow, {
			props: { row },
		})

		const input = wrapper.find('input')
		await input.trigger('keydown', { key: 'Enter' })

		expect(wrapper.emitted('row-keydown')).toBeTruthy()
		expect(wrapper.emitted('row-keydown')[0][0]).toBe('r1')
	})

	it('renders handle, toggle/triangle/bullet, and note slots', () => {
		const row = { id: 'r1', text: 'Sample', note: '', collapsed: false, children: [] }
		wrapper = mount(OutlineRow, {
			props: { row },
			slots: {
				handle: '<div class="custom-handle">H</div>',
				bullet: '<div class="custom-bullet">•</div>',
				note: '<div class="custom-note">Note content</div>',
			},
		})

		expect(wrapper.find('.custom-handle').text()).toBe('H')
		expect(wrapper.find('.custom-bullet').text()).toBe('•')
		expect(wrapper.find('.custom-note').text()).toBe('Note content')
	})

	it('hides children when collapsed is true and shows them when collapsed is false', () => {
		const collapsedRow = {
			id: 'r1',
			text: 'Parent',
			note: '',
			collapsed: true,
			children: [
				{ id: 'c1', text: 'Child', note: '', collapsed: false, children: [] },
			],
		}
		wrapper = mount(OutlineRow, {
			props: { row: collapsedRow },
		})

		expect(wrapper.find('[data-row-id="c1"]').exists()).toBe(false)
	})
})
