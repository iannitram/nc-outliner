import { NcThemeProvider } from '@nextcloud/vue'
import { mount } from '@vue/test-utils'
import { afterEach, describe, expect, it } from 'vitest'
import ConflictDialog from '../../../src/components/ConflictDialog.vue'

let wrapper

// Query the attached DOM so the checks also cover teleported content.
function show(props) {
	wrapper = mount(ConflictDialog, { props, attachTo: document.body })
	return wrapper
}
function button(label) {
	return Array.from(document.body.querySelectorAll('button'))
		.find((el) => el.textContent.trim() === label)
}

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	document.body.innerHTML = ''
})

describe('ConflictDialog', () => {
	it.each(['dark', 'light'])('keeps the open dialog inside the forced %s theme', async (theme) => {
		// The setup host sits earlier in body than the provider's host; drop it so the
		// dialog can only teleport into the host inside the provider.
		document.getElementById('nc-outliner-dialogs')?.remove()
		wrapper = mount({
			components: { NcThemeProvider, ConflictDialog },
			props: ['theme', 'open'],
			template: `<NcThemeProvider :dark="theme === 'dark'" :light="theme === 'light'">
				<div id="nc-outliner-dialogs" />
				<ConflictDialog :open="open" name="Trip plan" />
			</NcThemeProvider>`,
		}, { props: { theme, open: false }, attachTo: document.body })

		await wrapper.setProps({ open: true })

		const provider = wrapper.get(`[data-theme-${theme}]`).element
		const dialog = document.body.querySelector('[role="dialog"]')
		expect(dialog).not.toBeNull()
		expect(dialog.closest(`[data-theme-${theme}]`)).toBe(provider)
	})

	it('1. with open true, shows the outline name and both buttons', () => {
		show({ open: true, name: 'Trip plan' })

		expect(document.body.textContent).toContain('Trip plan was changed in another tab or device. Your changes are not saved yet.')
		expect(document.body.textContent).toContain('Changed somewhere else')
		expect(button('Reload')).toBeTruthy()
		expect(button('Keep mine as a copy')).toBeTruthy()
	})

	it('2. Reload emits reload once and Keep mine as a copy emits keepCopy once', async () => {
		show({ open: true, name: 'Trip plan' })

		button('Reload').click()
		await wrapper.vm.$nextTick()
		expect(wrapper.emitted('reload')).toHaveLength(1)
		expect(wrapper.emitted('keepCopy')).toBeUndefined()

		button('Keep mine as a copy').click()
		await wrapper.vm.$nextTick()
		expect(wrapper.emitted('keepCopy')).toHaveLength(1)
		expect(wrapper.emitted('reload')).toHaveLength(1)
	})

	it('renders at page level in the dialog host, outside the component root', async () => {
		show({ open: true, name: 'Trip plan' })

		const dialog = document.querySelector('#nc-outliner-dialogs [role="dialog"]')
		expect(dialog).not.toBeNull()
		expect(wrapper.element.contains(dialog)).toBe(false)
	})

	it('3. with open false, nothing is rendered', () => {
		show({ open: false, name: 'Trip plan' })

		expect(document.body.textContent).not.toContain('Trip plan')
		expect(button('Reload')).toBeUndefined()
		expect(button('Keep mine as a copy')).toBeUndefined()
	})
})
