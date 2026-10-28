import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ConflictDialog from '../../../src/components/ConflictDialog.vue'

let wrapper

function show(props) {
	wrapper = mount(ConflictDialog, { props, attachTo: document.body })
	return wrapper
}

function button(label) {
	return Array.from(document.body.querySelectorAll('button')).find((el) => el.textContent.trim() === label)
}

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	document.body.innerHTML = ''
})

describe('ConflictDialog', () => {
	it('shows the outline name and both choices', () => {
		show({ open: true, name: 'Trip plan' })
		expect(document.body.textContent).toContain('Trip plan was changed in another tab or device. Your changes are not saved yet.')
		expect(document.body.textContent).toContain('Changed somewhere else')
		expect(button('Reload')).toBeTruthy()
		expect(button('Keep mine as a copy')).toBeTruthy()
	})

	it('emits the selected action', async () => {
		show({ open: true, name: 'Trip plan' })
		button('Reload').click()
		await wrapper.vm.$nextTick()
		expect(wrapper.emitted('reload')).toHaveLength(1)
		button('Keep mine as a copy').click()
		await wrapper.vm.$nextTick()
		expect(wrapper.emitted('keepCopy')).toHaveLength(1)
	})

	it('renders nothing when closed', () => {
		show({ open: false, name: 'Trip plan' })
		expect(document.body.textContent).not.toContain('Trip plan')
		expect(button('Reload')).toBeUndefined()
		expect(button('Keep mine as a copy')).toBeUndefined()
	})
})
