import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import SortDialog from '../../../src/components/SortDialog.vue'
import { createHistory } from '../../../src/model/history.js'
import { sortRows } from '../../../src/model/outline.js'

let wrapper

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	document.body.innerHTML = ''
})

function button(label) {
	return Array.from(document.body.querySelectorAll('button')).find((el) => el.textContent.trim() === label)
}

describe('SortDialog', () => {
	it('renders nothing while closed', () => {
		wrapper = mount(SortDialog, { props: { open: false }, attachTo: document.body })
		expect(document.body.textContent).not.toContain('Sort by')
	})

	it('offers the sort fields, the order and the undo line', () => {
		wrapper = mount(SortDialog, { props: { open: true }, attachTo: document.body })
		const text = document.body.textContent
		for (const word of ['Row text', 'Note', 'Checkbox (from imported files)', 'A → Z', 'Z → A']) {
			expect(text).toContain(word)
		}
		expect(text).toContain('Sorts the rows under every heading, at every level. Undo with Ctrl+Z.')
	})

	it('emits the default choice, then the chosen field and order', async () => {
		wrapper = mount(SortDialog, { props: { open: true }, attachTo: document.body })
		button('Sort').click()
		expect(wrapper.emitted('sort')).toEqual([[{ by: 'text', direction: 'asc' }]])

		const note = document.body.querySelector('input[name="sort-by"][value="note"]')
		note.click()
		const desc = document.body.querySelector('input[name="sort-order"][value="desc"]')
		desc.click()
		await wrapper.vm.$nextTick()
		button('Sort').click()
		expect(wrapper.emitted('sort')[1]).toEqual([{ by: 'note', direction: 'desc' }])
	})

	it('closes from Cancel', () => {
		wrapper = mount(SortDialog, { props: { open: true }, attachTo: document.body })
		button('Cancel').click()
		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('its choice sorts through History in one undoable step', () => {
		const history = createHistory([
			{ id: 'b', text: 'Beta', note: '', collapsed: false, children: [] },
			{ id: 'a', text: 'Alpha', note: '', collapsed: false, children: [] },
		])
		history.execute(sortRows, ['text', 'desc'])
		history.undo()
		expect(history.current().map((row) => row.id)).toEqual(['b', 'a'])
	})
})
