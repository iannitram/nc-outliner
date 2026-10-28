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

	it('shows Auto, Light, and Dark options and displays current value', () => {
		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto' },
		})

		const select = wrapper.get('select[aria-label="Theme"]')
		expect(select.element.value).toBe('auto')

		const options = wrapper.findAll('option')
		expect(options).toHaveLength(3)
		expect(options.map((opt) => opt.text())).toEqual(['Auto', 'Light', 'Dark'])
		expect(options.map((opt) => opt.element.value)).toEqual(['auto', 'light', 'dark'])
	})

	it('saves the choice and emits update:modelValue when Dark is selected', async () => {
		setSettings.mockResolvedValueOnce({ theme: 'dark' })
		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto' },
		})

		await wrapper.get('select[aria-label="Theme"]').setValue('dark')
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

		await wrapper.get('select[aria-label="Theme"]').setValue('light')
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('light')
		expect(wrapper.emitted('update:modelValue')).toEqual([['light']])
	})

	it('reverts the select and displays an error message when saving fails', async () => {
		setSettings.mockRejectedValueOnce(new Error('Network error'))
		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto' },
		})

		await wrapper.get('select[aria-label="Theme"]').setValue('dark')
		await flushPromises()

		expect(setSettings).toHaveBeenCalledWith('dark')
		expect(wrapper.emitted('update:modelValue')).toBeUndefined()
		expect(wrapper.get('select[aria-label="Theme"]').element.value).toBe('auto')
		const alert = wrapper.get('[role="alert"]')
		expect(alert.text()).toContain('Could not save the theme setting.')
		expect(wrapper.emitted('error')).toHaveLength(1)
	})

	it('disables the select when disabled prop is true or while saving is pending', async () => {
		let finishSave
		setSettings.mockReturnValueOnce(new Promise((resolve) => {
			finishSave = resolve
		}))

		const wrapper = mount(ThemeSetting, {
			props: { modelValue: 'auto', disabled: false },
		})

		expect(wrapper.get('select').element.disabled).toBe(false)

		await wrapper.get('select').setValue('dark')
		expect(wrapper.get('select').element.disabled).toBe(true)

		finishSave({ theme: 'dark' })
		await flushPromises()

		expect(wrapper.get('select').element.disabled).toBe(false)

		await wrapper.setProps({ disabled: true })
		expect(wrapper.get('select').element.disabled).toBe(true)
	})
})
