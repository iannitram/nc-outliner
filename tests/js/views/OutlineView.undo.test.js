import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, describe, expect, it, vi } from 'vitest'
import OutlineView from '../../../src/views/OutlineView.vue'
import { readOutline, saveOutline } from '../../../src/api/outlines.js'

// #205: after a dialog (Sort rows…) closes, focus sits on a button outside the rows, and
// Ctrl+Z / Ctrl+Shift+Z there must still undo / redo the outline.

if (typeof globalThis.ResizeObserver === 'undefined') {
	globalThis.ResizeObserver = class {
		observe() {}
		unobserve() {}
		disconnect() {}
	}
}

vi.mock('@nextcloud/dialogs', () => ({ showSuccess: vi.fn(), showError: vi.fn() }))
vi.mock('../../../src/api/outlines.js', () => ({
	exportOpml: vi.fn(),
	listOutlines: vi.fn(),
	readOutline: vi.fn(),
	saveCopy: vi.fn(),
	saveOutline: vi.fn(),
}))
vi.mock('../../../src/api/versions.js', () => ({
	listVersions: vi.fn(),
	readVersion: vi.fn(),
	restoreVersion: vi.fn(),
	nameVersion: vi.fn(),
}))

const outline = {
	title: 'Plan',
	rows: [
		{ id: 'a', text: 'Apple', note: '', collapsed: false, children: [] },
		{ id: 'b', text: 'Banana', note: '', collapsed: false, children: [] },
	],
	publishPath: null,
}

const texts = (wrapper) => wrapper.findAll('.outline-row__input').map((input) => input.element.value)

function pressOn(el, init) {
	const event = new KeyboardEvent('keydown', { bubbles: true, cancelable: true, ...init })
	el.dispatchEvent(event)
	return event
}

describe('OutlineView undo outside the rows (#205)', () => {
	let wrapper
	afterEach(() => {
		wrapper?.unmount()
		wrapper = undefined
		document.body.innerHTML = ''
	})

	it('Ctrl+Z on a button outside the rows undoes the last change, and Ctrl+Shift+Z redoes it', async () => {
		readOutline.mockResolvedValue({ fileId: 3, name: 'Plan.opml', etag: 'e1', outline })
		saveOutline.mockResolvedValue({ etag: 'e2' })
		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		expect(texts(wrapper)).toEqual(['Apple', 'Banana'])

		await wrapper.findAll('.outline-row__input')[0].setValue('Apricot')
		expect(texts(wrapper)).toEqual(['Apricot', 'Banana'])

		const button = document.createElement('button')
		document.body.append(button)
		button.focus()

		const undo = pressOn(button, { key: 'z', ctrlKey: true })
		await flushPromises()
		expect(undo.defaultPrevented).toBe(true)
		expect(texts(wrapper)).toEqual(['Apple', 'Banana'])

		pressOn(button, { key: 'Z', ctrlKey: true, shiftKey: true })
		await flushPromises()
		expect(texts(wrapper)).toEqual(['Apricot', 'Banana'])
	})

	it('leaves Ctrl+Z alone in an unrelated text field', async () => {
		readOutline.mockResolvedValue({ fileId: 3, name: 'Plan.opml', etag: 'e1', outline })
		saveOutline.mockResolvedValue({ etag: 'e2' })
		wrapper = mount(OutlineView, { props: { fileId: 3 }, attachTo: document.body })
		await flushPromises()
		await wrapper.findAll('.outline-row__input')[0].setValue('Apricot')

		const field = document.createElement('input')
		document.body.append(field)
		field.focus()
		const event = pressOn(field, { key: 'z', ctrlKey: true })
		await flushPromises()
		expect(event.defaultPrevented).toBe(false)
		expect(texts(wrapper)).toEqual(['Apricot', 'Banana'])
	})
})
