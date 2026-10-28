import { flushPromises, mount } from '@vue/test-utils'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import ThemeSetting from '../../../src/components/ThemeSetting.vue'
import { setSettings } from '../../../src/api/outlines.js'

vi.mock('../../../src/api/outlines.js', () => ({
	setSettings: vi.fn(),
}))

describe('ThemeSetting.vue', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('shows Follow Nextcloud, Light, and Dark radios and displays current value', () => {
		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto' },
		})

		const options = wrapper.findAll('input[type="radio"]')
		expect(options).toHaveLength(3)
		expect(wrapper.findAll('label').map((label) => label.text())).toEqual(['Follow Nextcloud', 'Light', 'Dark'])
		expect(options.map((opt) => opt.element.value)).toEqual(['auto', 'light', 'dark'])
		expect(wrapper.get('input[value="auto"]').element.checked).toBe(true)
	})

	it('saves the choice and emits update:modelValue when Dark is selected', async () => {
		setSettings.mockResolvedValueOnce({ theme: 'dark' })
		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto' },
		})

		await wrapper.get('input[value="dark"]').setValue()
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('dark')
		expect(wrapper.emitted('update:modelValue')).toEqual([['dark']])
		expect(wrapper.find('[role="alert"]').exists()).toBe(false)
	})

	it('saves the choice and emits update:modelValue when Light is selected', async () => {
		setSettings.mockResolvedValueOnce({ theme: 'light' })
		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto' },
		})

		await wrapper.get('input[value="light"]').setValue()
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('light')
		expect(wrapper.emitted('update:modelValue')).toEqual([['light']])
	})

	it('reverts the radios and displays an error message when saving fails', async () => {
		setSettings.mockRejectedValueOnce(new Error('Network error'))
		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto' },
		})

		await wrapper.get('input[value="dark"]').setValue()
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('dark')
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(wrapper.get('input[value="auto"]').element.checked).toBe(true)
		expect(wrapper.get('input[value="dark"]').element.checked).toBe(false)
		const alert = wrapper.get('[role="alert"]')
		expect(alert.text()).toContain('Could not save the theme setting.')
		expect(wrapper.emitted('error')).toHaveLength(1)
	})

	it('disables the radios when disabled prop is true or while saving is pending', async () => {
		let finishSave
		setSettings.mockReturnValueOnce(new Promise((resolve) => {
			finishSave = resolve
		}))

		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto', disabled: false },
		})

		expect(wrapper.get('input[value="dark"]').element.disabled).toBe(false)

		await wrapper.get('input[value="dark"]').setValue()
		expect(wrapper.get('input[value="dark"]').element.disabled).toBe(true)

		finishSave({ theme: 'dark' })
		await flushPromises()

		expect(wrapper.get('input[value="dark"]').element.disabled).toBe(false)

		await wrapper.setProps({ disabled: true })
		expect(wrapper.get('input[value="dark"]').element.disabled).toBe(true)
	})
})
