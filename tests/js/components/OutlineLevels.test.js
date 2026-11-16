import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, describe, expect, it } from 'vitest'
import OutlineEditor from '../../../src/components/OutlineEditor.vue'
import OutlineRow from '../../../src/components/OutlineRow.vue'
import { createHistory } from '../../../src/model/history.js'

/**
 * A tree that covers every level case:
 * r1 depth 0 with children (level-1), r2 depth 1 with children (level-2),
 * r3 depth 2 (body), r4 depth 1 without children (body), r5 depth 0 without children (level-1).
 *
 * @return {object[]} the tree
 */
function levelTree() {
	return [
		{
			id: 'r1',
			text: 'Top',
			note: '',
			collapsed: false,
			children: [
				{
					id: 'r2',
					text: 'Parent',
					note: '',
					collapsed: false,
					children: [{ id: 'r3', text: 'Deep', note: '', collapsed: false, children: [] }],
				},
				{ id: 'r4', text: 'Leaf', note: '', collapsed: false, children: [] },
			],
		},
		{ id: 'r5', text: 'Alone', note: '', collapsed: false, children: [] },
	]
}

describe('OutlineRow level class', () => {
	let wrapper

	afterEach(() => {
		if (wrapper) {
			wrapper.unmount()
			wrapper = null
		}
	})

	it.each([
		['depth 0 with children', 0, [{ id: 'c', text: 'x', note: '', collapsed: false, children: [] }], 'level-1'],
		['depth 0 without children', 0, [], 'level-1'],
		['depth 1 with children', 1, [{ id: 'c', text: 'x', note: '', collapsed: false, children: [] }], 'level-2'],
		['depth 1 without children', 1, [], 'body'],
		['depth 2 with children', 2, [{ id: 'c', text: 'x', note: '', collapsed: false, children: [] }], 'body'],
		['depth 2 without children', 2, [], 'body'],
	])('gives %s the %s class', (_, depth, children, expected) => {
		const row = { id: 'r1', text: 'Row', note: '', collapsed: false, children }
		wrapper = mount(OutlineRow, { props: { row, depth } })

		const root = wrapper.find('[data-row-id="r1"]')
		expect(root.classes()).toContain(expected)
		for (const other of ['level-1', 'level-2', 'body']) {
			if (other !== expected) {
				expect(root.classes()).not.toContain(other)
			}
		}
	})
})

describe('OutlineEditor level classes by depth', () => {
	let wrapper

	afterEach(() => {
		if (wrapper) {
			wrapper.unmount()
			wrapper = null
		}
	})

	it('classes each row by its depth and whether it has children', () => {
		const history = createHistory(levelTree())
		wrapper = mount(OutlineEditor, { props: { history } })

		expect(wrapper.find('[data-row-id="r1"]').classes()).toContain('level-1')
		expect(wrapper.find('[data-row-id="r2"]').classes()).toContain('level-2')
		expect(wrapper.find('[data-row-id="r3"]').classes()).toContain('body')
		expect(wrapper.find('[data-row-id="r4"]').classes()).toContain('body')
		expect(wrapper.find('[data-row-id="r5"]').classes()).toContain('level-1')
	})

	it('shows the number of hidden rows on a folded branch', async () => {
		const history = createHistory(levelTree())
		wrapper = mount(OutlineEditor, { props: { history } })

		expect(wrapper.find('[data-row-id="r1"] > .outline-row__line .outline-row__more').exists()).toBe(false)

		await wrapper.find('[data-row-id="r1"] > .outline-row__line .outline-row__disclosure').trigger('click')

		const more = wrapper.find('[data-row-id="r1"] > .outline-row__line .outline-row__more')
		expect(more.exists()).toBe(true)
		expect(more.text()).toBe('3 rows')
	})
})

describe('folded label placement and dark bands', () => {
	it('sizes the folded input to its title', async () => {
		const history = createHistory(levelTree())
		const wrapper = mount(OutlineEditor, { props: { history } })
		const input = () => wrapper.find('[data-row-id="r1"] > .outline-row__line .outline-row__input')
		expect(input().classes()).not.toContain('outline-row__input--folded')
		await wrapper.find('[data-row-id="r1"] > .outline-row__line .outline-row__disclosure').trigger('click')
		expect(input().classes()).toContain('outline-row__input--folded')
		expect(input().attributes('style')).toContain('--title-ch: 3')
		wrapper.unmount()
	})

	it('declares the dark band percentages for every dark case', () => {
		const source = readFileSync(resolve(__dirname, '../../../src/components/OutlineEditor.vue'), 'utf8')
		const css = source.slice(source.indexOf('<style'))
		for (const selector of ['[data-themes*=dark] .outline-editor', 'body[data-theme-dark] .outline-editor', '[data-theme-dark] .outline-editor']) {
			expect(css).toContain(selector)
		}
		const media = css.slice(css.indexOf('@media (prefers-color-scheme: dark)'))
		expect(media).toContain('[data-themes*=default] .outline-editor')
		expect(media).toContain('body[data-theme-default] .outline-editor')
		expect(media).toMatch(/--band-1:[^;]*13%/)
		expect(media).toMatch(/--band-2:[^;]*6%/)
		const forced = media.indexOf('body [data-theme-light] .outline-editor')
		expect(forced).toBeGreaterThan(media.indexOf('body[data-theme-default] .outline-editor'))
		expect(media.slice(forced, media.indexOf('{', forced))).toMatch(/,\s*\[data-theme-light\] \.outline-editor\s*$/)
		expect(media.slice(forced)).toMatch(/--band-1:[^;]*9%/)
		expect(media.slice(forced)).toMatch(/--band-2:[^;]*4%/)
	})
})
