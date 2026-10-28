import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OutlineRow from '../../../src/components/OutlineRow.vue'
import { createHistory } from '../../../src/model/history.js'
import { updateRow } from '../../../src/model/outline.js'

describe('OutlineRow', () => {
	let wrapper

	afterEach(() => {
		vi.unstubAllGlobals()
		if (wrapper) {
			wrapper.unmount()
			wrapper = null
		}
	})

	it('renders row text in a wrapping textarea and exposes focus method', () => {
		const row = { id: 'r1', text: 'Sample text', note: '', collapsed: false, children: [] }
		wrapper = mount(OutlineRow, {
			props: { row },
			attachTo: document.body,
		})

		const input = wrapper.find('.outline-row__input')
		expect(input.element.value).toBe('Sample text')

		wrapper.vm.focus('end')
		expect(document.activeElement).toBe(input.element)
		expect(input.element.selectionStart).toBe('Sample text'.length)
		expect(input.element.selectionEnd).toBe('Sample text'.length)

		wrapper.vm.focus('start')
		expect(input.element.selectionStart).toBe(0)
		expect(input.element.selectionEnd).toBe(0)
	})

	it('grows wrapped text on input, width changes and History updates, then disconnects', async () => {
		let resize
		const disconnect = vi.fn()
		vi.stubGlobal('ResizeObserver', class {
			constructor(callback) { resize = callback }
			observe() {}
			disconnect() { disconnect() }
		})
		const row = { id: 'r1', text: 'A long row', note: '', collapsed: false, children: [] }
		wrapper = mount(OutlineRow, { props: { row } })
		const input = wrapper.get('textarea.outline-row__input')
		let height = 72
		Object.defineProperty(input.element, 'scrollHeight', { get: () => height })
		await input.setValue('A longer row that wraps')
		expect(input.element.style.height).toBe('74px')
		height = 108
		resize([{ contentRect: { width: 200 } }])
		expect(input.element.style.height).toBe('110px')
		height = 24
		await wrapper.setProps({ row: { ...row, text: 'Undo' } })
		expect(input.element.style.height).toBe('26px')
		wrapper.unmount()
		wrapper = null
		expect(disconnect).toHaveBeenCalledOnce()
	})

	it('emits input-text on input', async () => {
		const row = { id: 'r1', text: 'Sample', note: '', collapsed: false, children: [] }
		wrapper = mount(OutlineRow, {
			props: { row },
		})

		const input = wrapper.find('.outline-row__input')
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

		const input = wrapper.find('.outline-row__input')
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
		expect(wrapper.get('.outline-row__note-toggle').attributes('aria-label')).toBe('Hide note')
		expect(wrapper.get('.outline-row__note-toggle').text()).toBe('')
		expect(wrapper.find('.outline-row__note-toggle svg').exists()).toBe(true)
		expect(wrapper.get('.outline-row__note-toggle').classes()).not.toContain('outline-row__note-toggle--always')
		wrapper.unmount()

		wrapper = mount(OutlineRow, {
			props: { row: { ...row, noteHidden: true } },
		})

		expect(wrapper.find('textarea[data-note-id="r1"]').exists()).toBe(false)
		expect(wrapper.get('.outline-row__note-toggle').attributes('aria-label')).toBe('Show note')
		expect(wrapper.get('.outline-row__note-toggle').classes()).toContain('outline-row__note-toggle--always')
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

	it('keeps noteHidden through History when the note icon is clicked', async () => {
		const row = { id: 'r1', text: 'Sample', note: 'Note text', collapsed: false, noteHidden: false, children: [] }
		const history = createHistory([row])
		wrapper = mount(OutlineRow, {
			props: { row },
			global: {
				provide: {
					outlineEditor: { history, registerInput() {}, unregisterInput() {} },
				},
			},
		})

		await wrapper.get('.outline-row__note-toggle').trigger('click')
		expect(history.current()[0].noteHidden).toBe(true)
		expect(history.current()[0].note).toBe('Note text')

		await wrapper.setProps({ row: history.current()[0] })
		expect(wrapper.find('textarea[data-note-id="r1"]').exists()).toBe(false)
		await wrapper.get('.outline-row__note-toggle').trigger('click')
		expect(history.current()[0].noteHidden).toBe(false)
	})

	it('renders a disclosure control for rows with children and a bullet for leaves', () => {
		wrapper = mount(OutlineRow, {
			props: {
				row: {
					id: 'r1',
					text: 'Parent',
					note: '',
					collapsed: false,
					children: [{ id: 'c1', text: 'Child', note: '', collapsed: false, children: [] }],
				},
			},
		})

		expect(wrapper.find('button[aria-expanded="true"]').exists()).toBe(true)
		expect(wrapper.find('[data-row-id="r1"] > .outline-row__line .outline-row__bullet').exists()).toBe(false)
	})

	// jsdom does no layout, so pin the alignment rules in the component's CSS source.
	describe('first-line alignment CSS', () => {
		const css = readFileSync(resolve(process.cwd(), 'src/components/OutlineRow.vue'), 'utf8')
		const rule = (selector) => {
			const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
			const match = css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))
			return match ? match[1] : ''
		}

		it('keeps the line top-aligned so wrapped text starts at the top', () => {
			expect(rule('.outline-row__line')).toMatch(/align-items:\s*flex-start/)
		})

		it('gives the bullet and the row count the first line height', () => {
			expect(rule('.outline-row__bullet')).toMatch(/height:\s*34px/)
			expect(rule('.outline-row__bullet')).toMatch(/align-items:\s*center/)
			expect(rule('.outline-row__more')).toMatch(/height:\s*34px/)
			expect(rule('.outline-row__more')).toMatch(/align-items:\s*center/)
		})
	})
})
