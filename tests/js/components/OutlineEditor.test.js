import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineEditor from '../../../src/components/OutlineEditor.vue'
import * as keymap from '../../../src/editor/keymap.js'
import { createHistory } from '../../../src/model/history.js'
import { updateRow } from '../../../src/model/outline.js'

describe('OutlineEditor', () => {
	let wrapper

	beforeEach(() => {
		vi.restoreAllMocks()
	})

	afterEach(() => {
		if (wrapper) {
			wrapper.unmount()
			wrapper = null
		}
	})

	it('mounts with a History over a 3-row tree, types into a row and sees tree change through updateRow with mergeKey: "text:<id>"', async () => {
		const initialTree = [
			{ id: 'r1', text: 'First row', note: '', collapsed: false, children: [] },
			{ id: 'r2', text: 'Second row', note: '', collapsed: false, children: [] },
			{ id: 'r3', text: 'Third row', note: '', collapsed: false, children: [] },
		]
		const history = createHistory(initialTree)
		const executeSpy = vi.spyOn(history, 'execute')

		wrapper = mount(OutlineEditor, {
			props: { history },
			attachTo: document.body,
		})

		const inputs = wrapper.findAll('input')
		expect(inputs).toHaveLength(3)
		expect(inputs[0].element.value).toBe('First row')

		await inputs[0].setValue('Updated row text')

		expect(executeSpy).toHaveBeenCalledWith(
			updateRow,
			['r1', { text: 'Updated row text' }],
			{ mergeKey: 'text:r1' },
		)
		expect(history.current()[0].text).toBe('Updated row text')
		expect(inputs[0].element.value).toBe('Updated row text')
	})

	it('calls runCommand and preventDefault when a keydown is mapped to a command', async () => {
		const initialTree = [
			{ id: 'r1', text: 'Row 1', note: '', collapsed: false, children: [] },
			{ id: 'r2', text: 'Row 2', note: '', collapsed: false, children: [] },
			{ id: 'r3', text: 'Row 3', note: '', collapsed: false, children: [] },
		]
		const history = createHistory(initialTree)
		wrapper = mount(OutlineEditor, {
			props: { history },
			attachTo: document.body,
		})

		const input = wrapper.find('input')
		const runCommandSpy = vi.spyOn(keymap, 'runCommand').mockImplementation(() => {})
		vi.spyOn(keymap, 'commandForKey').mockReturnValue('newRowBelow')

		const event = new KeyboardEvent('keydown', {
			key: 'Enter',
			cancelable: true,
			bubbles: true,
		})
		input.element.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(true)
		expect(runCommandSpy).toHaveBeenCalledWith('newRowBelow', expect.objectContaining({
			history,
			rowId: 'r1',
			focus: expect.any(Function),
		}))
	})

	it('does not preventDefault or call runCommand when a keydown is unmapped', async () => {
		const initialTree = [
			{ id: 'r1', text: 'Row 1', note: '', collapsed: false, children: [] },
		]
		const history = createHistory(initialTree)
		wrapper = mount(OutlineEditor, {
			props: { history },
			attachTo: document.body,
		})

		const input = wrapper.find('input')
		const runCommandSpy = vi.spyOn(keymap, 'runCommand').mockImplementation(() => {})
		vi.spyOn(keymap, 'commandForKey').mockReturnValue(null)

		const event = new KeyboardEvent('keydown', {
			key: 'a',
			cancelable: true,
			bubbles: true,
		})
		input.element.dispatchEvent(event)

		expect(event.defaultPrevented).toBe(false)
		expect(runCommandSpy).not.toHaveBeenCalled()
	})

	it('builds KeyContext from input state and isMac() for commandForKey', () => {
		const initialTree = [
			{
				id: 'r1',
				text: 'Sample',
				note: '',
				collapsed: false,
				children: [
					{ id: 'r2', text: 'Child', note: '', collapsed: false, children: [] },
				],
			},
		]
		const history = createHistory(initialTree)
		wrapper = mount(OutlineEditor, {
			props: { history },
			attachTo: document.body,
		})

		const commandForKeySpy = vi.spyOn(keymap, 'commandForKey').mockReturnValue(null)
		const input = wrapper.find('[data-row-id="r1"] input')

		input.element.setSelectionRange(0, 0)
		input.element.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft', bubbles: true }))

		expect(commandForKeySpy).toHaveBeenCalledWith(
			expect.any(KeyboardEvent),
			expect.objectContaining({
				isMac: keymap.isMac(),
				rowEmpty: false,
				caretAtStart: true,
				caretAtEnd: false,
				hasChildren: true,
				collapsed: false,
			}),
		)
	})

	it('focus(rowId, "start"|"end") puts the caret there', () => {
		const initialTree = [
			{ id: 'r1', text: 'Alpha', note: '', collapsed: false, children: [] },
			{ id: 'r2', text: 'Beta test', note: '', collapsed: false, children: [] },
			{ id: 'r3', text: 'Gamma', note: '', collapsed: false, children: [] },
		]
		const history = createHistory(initialTree)
		wrapper = mount(OutlineEditor, {
			props: { history },
			attachTo: document.body,
		})

		const r2Input = wrapper.find('[data-row-id="r2"] input')

		wrapper.vm.focus('r2', 'start')
		expect(document.activeElement).toBe(r2Input.element)
		expect(r2Input.element.selectionStart).toBe(0)
		expect(r2Input.element.selectionEnd).toBe(0)

		wrapper.vm.focus('r2', 'end')
		expect(document.activeElement).toBe(r2Input.element)
		expect(r2Input.element.selectionStart).toBe('Beta test'.length)
		expect(r2Input.element.selectionEnd).toBe('Beta test'.length)
	})

	it('collapsed rows hide their children', async () => {
		const initialTree = [
			{
				id: 'r1',
				text: 'Parent',
				note: '',
				collapsed: true,
				children: [
					{ id: 'r2', text: 'Child 1', note: '', collapsed: false, children: [] },
					{ id: 'r3', text: 'Child 2', note: '', collapsed: false, children: [] },
				],
			},
		]
		const history = createHistory(initialTree)
		wrapper = mount(OutlineEditor, {
			props: { history },
			attachTo: document.body,
		})

		expect(wrapper.find('[data-row-id="r1"]').exists()).toBe(true)
		expect(wrapper.find('[data-row-id="r2"]').exists()).toBe(false)
		expect(wrapper.find('[data-row-id="r3"]').exists()).toBe(false)

		history.execute(updateRow, ['r1', { collapsed: false }])
		await wrapper.vm.$nextTick()

		expect(wrapper.find('[data-row-id="r1"]').exists()).toBe(true)
		expect(wrapper.find('[data-row-id="r2"]').exists()).toBe(true)
		expect(wrapper.find('[data-row-id="r3"]').exists()).toBe(true)
	})

	it('renders handle, toggle/triangle/bullet, and note slots', () => {
		const initialTree = [
			{ id: 'r1', text: 'Row with slots', note: '', collapsed: false, children: [] },
		]
		const history = createHistory(initialTree)
		wrapper = mount(OutlineEditor, {
			props: { history },
			slots: {
				handle: '<span class="slot-handle">drag</span>',
				bullet: '<span class="slot-bullet">dot</span>',
				note: '<div class="slot-note">my note</div>',
			},
		})

		expect(wrapper.find('.slot-handle').text()).toBe('drag')
		expect(wrapper.find('.slot-bullet').text()).toBe('dot')
		expect(wrapper.find('.slot-note').text()).toBe('my note')
	})

	it('sorts rows through shared history so the change can be undone', async () => {
		const history = createHistory([
			{ id: 'b', text: 'Beta', note: '', collapsed: false, children: [] },
			{ id: 'a', text: 'Alpha', note: '', collapsed: false, children: [] },
		])
		wrapper = mount(OutlineEditor, { props: { history } })

		await wrapper.get('button:last-child').trigger('click')
		expect(history.current().map((row) => row.id)).toEqual(['a', 'b'])
		history.undo()
		expect(history.current().map((row) => row.id)).toEqual(['b', 'a'])

		await wrapper.get('select').setValue('note')
		await wrapper.findAll('button')[0].trigger('click')
		expect(wrapper.findAll('button')[0].text()).toContain('Descending')
	})
})
