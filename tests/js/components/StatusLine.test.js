import { mount } from '@vue/test-utils'
import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import StatusLine from '../../../src/components/StatusLine.vue'

describe('StatusLine.vue', () => {
	describe('status texts', () => {
		it('renders Saved when status is saved', () => {
			const wrapper = mount(StatusLine, {
				props: { status: 'saved' },
			})
			expect(wrapper.get('.save-status').text()).toBe('Saved')
			expect(wrapper.classes()).not.toContain('warn')
			expect(wrapper.get('.save-status').classes()).not.toContain('warn')
		})

		it('renders Saving… when status is saving', () => {
			const wrapper = mount(StatusLine, {
				props: { status: 'saving' },
			})
			expect(wrapper.get('.save-status').text()).toBe('Saving…')
			expect(wrapper.classes()).not.toContain('warn')
			expect(wrapper.get('.save-status').classes()).not.toContain('warn')
		})

		it('renders Can\'t save. Retrying with warning class when status is error', () => {
			const wrapper = mount(StatusLine, {
				props: { status: 'error' },
			})
			expect(wrapper.get('.save-status').text()).toBe("Can't save. Retrying")
			expect(wrapper.classes()).toContain('warn')
			expect(wrapper.get('.save-status').classes()).toContain('warn')
		})

		it('renders Changed elsewhere when status is conflict', () => {
			const wrapper = mount(StatusLine, {
				props: { status: 'conflict' },
			})
			expect(wrapper.get('.save-status').text()).toBe('Changed elsewhere')
			expect(wrapper.classes()).not.toContain('warn')
			expect(wrapper.get('.save-status').classes()).not.toContain('warn')
		})
	})

	describe('accessibility attributes', () => {
		it('maintains role="status" and aria-live="polite" on the save state element', () => {
			const wrapper = mount(StatusLine, {
				props: { status: 'saved' },
			})
			const saveStatus = wrapper.get('.save-status')
			expect(saveStatus.attributes('role')).toBe('status')
			expect(saveStatus.attributes('aria-live')).toBe('polite')
		})
	})

	describe('row and word counts', () => {
		it('counts 0 rows and 0 words for empty outline', () => {
			const wrapper = mount(StatusLine, {
				props: { status: 'saved', rows: [] },
			})
			expect(wrapper.get('.status-counts').text()).toBe('0 rows · 0 words')
		})

		it('formats singular 1 row and 1 word properly', () => {
			const wrapper = mount(StatusLine, {
				props: {
					status: 'saved',
					rows: [{ id: '1', text: 'Hello', note: '', children: [] }],
				},
			})
			expect(wrapper.get('.status-counts').text()).toBe('1 row · 1 word')
		})

		it('counts nested rows and words across text and notes', () => {
			const rows = [
				{
					id: '1',
					text: 'Site and layout',
					note: 'Check the fence line',
					children: [
						{
							id: '2',
							text: 'Beds and paths',
							note: '',
							children: [
								{ id: '3', text: 'Six raised beds', note: '', children: [] },
							],
						},
					],
				},
			]
			// Rows: 3
			// Words:
			// Row 1: "Site and layout" (3) + "Check the fence line" (4) = 7
			// Row 2: "Beds and paths" (3) = 3
			// Row 3: "Six raised beds" (3) = 3
			// Total words: 13
			const wrapper = mount(StatusLine, {
				props: { status: 'saved', rows },
			})
			expect(wrapper.get('.status-counts').text()).toBe('3 rows · 13 words')
		})

		it('accepts explicit rowCount and wordCount prop overrides', () => {
			const wrapper = mount(StatusLine, {
				props: {
					status: 'saved',
					rowCount: 21,
					wordCount: 164,
				},
			})
			expect(wrapper.get('.status-counts').text()).toBe('21 rows · 164 words')
		})
	})

	describe('last-published link', () => {
		it('keeps the narrow link clickable while its label can truncate', () => {
			const wrapper = mount(StatusLine, { props: { status: 'saved', publishPath: '/Documents/A long document.odt', openUrl: '/open/44' } })
			const link = wrapper.get('.published-link')
			expect(link.attributes('aria-label')).toBe('Open document')
			expect(link.attributes('href')).toBe('/open/44')
			expect(link.get('.status-link-label').text()).toContain('Open document')
			const source = readFileSync('src/components/StatusLine.vue', 'utf8')
			expect(source).toMatch(/\.status-link-label\s*\{[^}]*min-width: 0;[^}]*overflow: hidden;[^}]*text-overflow: ellipsis;/)
			expect(source).toMatch(/\.status-link\s*\{[^}]*min-width: 24px;/)
		})

		it('does not render published link when publishPath is null', () => {
			const wrapper = mount(StatusLine, {
				props: { status: 'saved', publishPath: null },
			})
			expect(wrapper.find('.published-link').exists()).toBe(false)
		})

		it('renders published link when publishPath is provided', () => {
			const wrapper = mount(StatusLine, {
				props: {
					status: 'saved',
					publishPath: '/Documents/Garden.odt',
					openUrl: '/apps/files/?openfile=true&fileid=44',
				},
			})
			const link = wrapper.get('.published-link')
			expect(link.attributes('href')).toBe('/apps/files/?openfile=true&fileid=44')
			expect(link.text()).toContain('Published to Documents/Garden.odt')
			expect(link.text()).toContain('Open document')
		})

		it('strips leading slash from publishPath for display', () => {
			const wrapper = mount(StatusLine, {
				props: {
					status: 'saved',
					publishPath: '/Work/Projects/Notes.odt',
				},
			})
			expect(wrapper.get('.publish-path').text()).toBe('Published to Work/Projects/Notes.odt ·')
		})
	})
})
