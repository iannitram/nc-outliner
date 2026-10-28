import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import OutlineEditor from '../../../src/components/OutlineEditor.vue'
import { createHistory } from '../../../src/model/history.js'

// #203: Tab / Shift+Tab re-render the row under a new parent; focus must follow the row's new input.
function key(el, keyName, extra = {}) {
	el.dispatchEvent(new KeyboardEvent('keydown', { key: keyName, bubbles: true, cancelable: true, ...extra }))
}

async function typeInto(el, text) {
	el.value += text
	el.dispatchEvent(new Event('input', { bubbles: true }))
	await flushPromises()
}

const activeInput = () => document.activeElement

describe('OutlineEditor keeps focus through structural moves (#203)', () => {
	let wrapper
	afterEach(() => {
		wrapper?.unmount()
		wrapper = null
	})

	it('Enter, Tab, then typing "B" lands in the indented row, which keeps the focus', async () => {
		const history = createHistory([{ id: 'a', text: 'A', note: '', collapsed: false, children: [] }])
		wrapper = mount(OutlineEditor, { props: { history }, attachTo: document.body })
		const first = wrapper.find('.outline-row__input').element
		first.focus()
		first.setSelectionRange(1, 1)

		key(first, 'Enter')
		await flushPromises()
		const newRow = activeInput()
		expect(newRow).not.toBe(first)
		expect(newRow.classList.contains('outline-row__input')).toBe(true)

		key(newRow, 'Tab')
		await flushPromises()
		expect(activeInput().classList.contains('outline-row__input')).toBe(true)
		expect(activeInput()).not.toBe(document.body)

		await typeInto(activeInput(), 'B')
		const tree = history.current()
		expect(tree).toHaveLength(1)
		expect(tree[0].children).toHaveLength(1)
		expect(tree[0].children[0].text).toBe('B')
		expect(activeInput().value).toBe('B')
	})

	it('Shift+Tab keeps the focus and the caret where it was', async () => {
		const history = createHistory([
			{ id: 'a', text: 'A', note: '', collapsed: false, children: [{ id: 'b', text: 'Beta', note: '', collapsed: false, children: [] }] },
		])
		wrapper = mount(OutlineEditor, { props: { history }, attachTo: document.body })
		const b = wrapper.find('[data-row-id="b"] .outline-row__input, .outline-row__input[data-row-id="b"]').element
		b.focus()
		b.setSelectionRange(2, 2)

		key(b, 'Tab', { shiftKey: true })
		await flushPromises()
		expect(history.current().map((r) => r.id)).toEqual(['a', 'b'])
		expect(activeInput().value).toBe('Beta')
		expect(activeInput().selectionStart).toBe(2)
	})
})
