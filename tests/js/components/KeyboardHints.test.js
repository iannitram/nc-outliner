import { mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import KeyboardHints from '../../../src/components/KeyboardHints.vue'
import OutlineEditor from '../../../src/components/OutlineEditor.vue'
import { createHistory } from '../../../src/model/history.js'

const KEY = 'nc_outliner.keyboardHintsHidden'

describe('KeyboardHints', () => {
	let wrapper

	beforeEach(() => {
		localStorage.removeItem(KEY)
	})

	afterEach(() => {
		wrapper?.unmount()
		wrapper = null
		vi.restoreAllMocks()
	})

	it('lists the keys that exist', () => {
		wrapper = mount(KeyboardHints, { props: { rowCount: 0 } })
		const text = wrapper.text()
		for (const word of ['Enter', 'Tab', 'Shift', 'Alt', 'Ctrl', 'Z', '↑', '↓', '←', '→']) {
			expect(text).toContain(word)
		}
	})

	it('shows Cmd and Option on a Mac', () => {
		vi.spyOn(globalThis.navigator, 'platform', 'get').mockReturnValue('MacIntel')
		wrapper = mount(KeyboardHints, { props: { rowCount: 0 } })
		expect(wrapper.text()).toContain('⌘')
		expect(wrapper.text()).toContain('⌥')
		expect(wrapper.text()).not.toContain('Ctrl')
	})

	it('hides itself at 5 or more rows', async () => {
		wrapper = mount(KeyboardHints, { props: { rowCount: 4 } })
		expect(wrapper.find('.keyboard-hints').exists()).toBe(true)
		await wrapper.setProps({ rowCount: 5 })
		expect(wrapper.find('.keyboard-hints').exists()).toBe(false)
	})

	it('remembers Hide per browser', async () => {
		wrapper = mount(KeyboardHints, { props: { rowCount: 1 } })
		await wrapper.get('.keyboard-hints__hide').trigger('click')
		expect(wrapper.find('.keyboard-hints').exists()).toBe(false)
		expect(localStorage.getItem(KEY)).toBe('1')
		wrapper.unmount()

		wrapper = mount(KeyboardHints, { props: { rowCount: 1 } })
		expect(wrapper.find('.keyboard-hints').exists()).toBe(false)
	})

	it('still works when localStorage throws', async () => {
		vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
			throw new Error('blocked')
		})
		vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
			throw new Error('blocked')
		})
		wrapper = mount(KeyboardHints, { props: { rowCount: 1 } })
		expect(wrapper.find('.keyboard-hints').exists()).toBe(true)
		await wrapper.get('.keyboard-hints__hide').trigger('click')
		expect(wrapper.find('.keyboard-hints').exists()).toBe(false)
	})

	it('counts nested rows in the editor', () => {
		const child = (id) => ({ id, text: id, note: '', collapsed: false, children: [] })
		const history = createHistory([
			{ id: 'a', text: 'a', note: '', collapsed: false, children: [child('b'), child('c'), child('d'), child('e')] },
		])
		wrapper = mount(OutlineEditor, { props: { history } })
		expect(wrapper.find('.keyboard-hints').exists()).toBe(false)
	})
})
