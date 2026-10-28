import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OutlineRow from '../../../src/components/OutlineRow.vue'
import { createHistory } from '../../../src/model/history.js'
import { updateRow } from '../../../src/model/outline.js'

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

	it('renders a note under the row and hides it when noteHidden is true', () => {
		const row = { id: 'r1', text: 'Sample', note: 'Note text', collapsed: false, noteHidden: false, children: [] }
		wrapper = mount(OutlineRow, {
			props: { row },
		})

		expect(wrapper.get('textarea[data-note-id="r1"]').element.value).toBe('Note text')
		expect(wrapper.get('.outline-row__note-toggle').text()).toBe('Hide note')
		wrapper.unmount()

		wrapper = mount(OutlineRow, {
			props: { row: { ...row, noteHidden: true } },
		})

		expect(wrapper.find('textarea[data-note-id="r1"]').exists()).toBe(false)
		expect(wrapper.get('.outline-row__note-toggle').text()).toBe('Show note')
	})

	it('writes a note through History with mergeKey "note:<id>"', async () => {
		const row = { id: 'r1', text: 'Sample', note: '', collapsed: false, noteHidden: false, children: [] }
		const history = createHistory([row])
		const executeSpy = vi.spyOn(history, 'execute')
		wrapper = mount(OutlineRow, {
			props: { row },
			global: {
				provide: {
					outlineEditor: {
						history,
						registerInput() {},
						unregisterInput() {},
					},
				},
			},
		})

		await wrapper.get('.outline-row__note-toggle').trigger('click')
		await wrapper.get('textarea[data-note-id="r1"]').setValue('A note')

		expect(executeSpy).toHaveBeenCalledWith(
			updateRow,
			['r1', { note: 'A note' }],
			{ mergeKey: 'note:r1' },
		)
		expect(history.current()[0].note).toBe('A note')
	})
})
