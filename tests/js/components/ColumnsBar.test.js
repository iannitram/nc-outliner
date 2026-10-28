import { mount } from '@vue/test-utils'
import { describe, expect, it } from 'vitest'
import ColumnsBar from '../../../src/components/ColumnsBar.vue'

describe('ColumnsBar', () => {
	it('keeps management controls available for a single hidden column', async () => {
		const wrapper = mount(ColumnsBar, { props: { outline: { columns: [{ id: 'c1', name: 'Estimate', type: 'number', width: 120, hidden: true }], rows: [] } } })
		expect(wrapper.find('[aria-label="Rename Estimate"]').exists()).toBe(true)
		await wrapper.find('input[type="checkbox"]').setValue(false)
		expect(wrapper.emitted('update:outline')?.[0][0].columns[0].hidden).toBe(false)
	})
})
