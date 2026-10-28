import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VersionsPanel from '../../../src/components/VersionsPanel.vue'
import { listVersions, nameVersion, readVersion, restoreVersion } from '../../../src/api/versions.js'

vi.mock('../../../src/api/versions.js', () => ({
	listVersions: vi.fn(),
	readVersion: vi.fn(),
	restoreVersion: vi.fn(),
	nameVersion: vi.fn(),
}))

const FILE_ID = 7
const at = (iso) => Date.parse(iso)
// Newest first, as listVersions returns them. The first entry is the file as it is now.
const current = { id: '300', time: at('2026-10-28T17:51:38Z'), label: '', size: 3 }
const named = { id: '200', time: at('2026-10-28T17:51:20Z'), label: 'Before rewrite', size: 3 }
const older = { id: '100', time: at('2026-10-28T17:51:02Z'), label: '', size: 3 }
// After a restore the state from before it is the new top entry (ADR 0004 spike).
const preRestore = { id: '400', time: at('2026-10-28T17:52:00Z'), label: '', size: 3 }

let wrapper
let calls

function rows() {
	return Array.from(document.body.querySelectorAll('li.version-row'))
}
function row(index) {
	return rows()[index]
}
function button(text, scope = document.body) {
	return Array.from(scope.querySelectorAll('button'))
		.find((el) => el.textContent.trim() === text)
}
function field(labelText, scope = document.body) {
	const label = Array.from(scope.querySelectorAll('label'))
		.find((el) => el.textContent.trim() === labelText)
	return document.getElementById(label.htmlFor)
}
async function click(el) {
	el.click()
	await flushPromises()
}
function open(props = {}) {
	wrapper = mount(VersionsPanel, {
		props: {
			fileId: FILE_ID,
			open: true,
			flush: vi.fn(async () => true),
			reload: vi.fn(async () => {}),
			...props,
		},
		attachTo: document.body,
	})
	return flushPromises()
}

beforeEach(() => {
	vi.clearAllMocks()
	calls = []
	listVersions.mockImplementation(async () => {
		calls.push('list')
		return [current, named, older]
	})
	readVersion.mockResolvedValue('old text of the outline')
	restoreVersion.mockImplementation(async () => {
		calls.push('restore')
	})
	nameVersion.mockResolvedValue()
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	document.body.innerHTML = ''
})

describe('VersionsPanel.vue', () => {
	it('lists names and times newest first and marks the current entry', async () => {
		await open()

		expect(listVersions).toHaveBeenCalledWith(FILE_ID)
		expect(rows()).toHaveLength(3)
		expect(row(0).querySelector('time').getAttribute('datetime')).toBe(new Date(current.time).toISOString())
		expect(row(1).querySelector('time').getAttribute('datetime')).toBe(new Date(named.time).toISOString())
		expect(row(2).querySelector('time').getAttribute('datetime')).toBe(new Date(older.time).toISOString())
		expect(row(0).textContent).toContain('Current')
		expect(row(0).textContent).not.toContain('Before rewrite')
		expect(row(1).textContent).toContain('Before rewrite')
		expect(row(1).textContent).not.toContain('Current')
		// The current file cannot be previewed or restored; older entries can.
		expect(button('Preview', row(0))).toBeUndefined()
		expect(button('Restore', row(0))).toBeUndefined()
		expect(button('Preview', row(1))).toBeTruthy()
		expect(button('Restore', row(2))).toBeTruthy()
	})

	it('shows the read-only text of an older version and no editor', async () => {
		await open()

		await click(button('Preview', row(2)))

		expect(readVersion).toHaveBeenCalledWith(FILE_ID, '100')
		const preview = document.body.querySelector('pre')
		expect(preview.textContent).toBe('old text of the outline')
		expect(document.body.querySelector('textarea, [contenteditable], [contenteditable="true"]')).toBeNull()
		expect(restoreVersion).not.toHaveBeenCalled()

		await click(button('Close preview'))
		expect(document.body.querySelector('pre')).toBeNull()
	})

	it('flushes before restoring, then reloads the outline, then offers to name the new top entry', async () => {
		const flush = vi.fn(async () => {
			calls.push('flush')
			return true
		})
		const reload = vi.fn(async () => {
			calls.push('reload')
		})
		listVersions.mockImplementation(async () => {
			calls.push('list')
			return calls.includes('restore') ? [preRestore, named, older] : [current, named, older]
		})
		await open({ flush, reload })

		await click(button('Restore', row(2)))

		expect(restoreVersion).toHaveBeenCalledWith(FILE_ID, '100')
		expect(flush).toHaveBeenCalledTimes(1)
		expect(reload).toHaveBeenCalledTimes(1)
		expect(calls).toEqual(['list', 'flush', 'restore', 'reload', 'list'])

		const offer = document.body.querySelector('.version-offer')
		expect(offer).not.toBeNull()
		expect(field('Name for the state before the restore', offer).value).toMatch(/^Before restore .+/)
	})

	it('names the new top entry when the naming offer is accepted', async () => {
		listVersions.mockImplementation(async () => (calls.includes('restore') ? [preRestore, named, older] : [current, named, older]))
		await open()
		await click(button('Restore', row(2)))
		const offer = document.body.querySelector('.version-offer')
		const defaultLabel = field('Name for the state before the restore', offer).value

		await click(button('Save name', offer))

		expect(nameVersion).toHaveBeenCalledTimes(1)
		expect(nameVersion).toHaveBeenCalledWith(FILE_ID, '400', defaultLabel)
		expect(document.body.querySelector('.version-offer')).toBeNull()
	})

	it('removes the naming offer when it is dismissed, without naming anything', async () => {
		listVersions.mockImplementation(async () => (calls.includes('restore') ? [preRestore, named, older] : [current, named, older]))
		await open()
		await click(button('Restore', row(2)))

		await click(button('Dismiss', document.body.querySelector('.version-offer')))

		expect(nameVersion).not.toHaveBeenCalled()
		expect(document.body.querySelector('.version-offer')).toBeNull()
	})

	it('names an older entry with a label typed into the row field', async () => {
		await open()

		await click(button('Name', row(2)))
		const input = field('Version name', row(2))
		input.value = 'Before rewrite'
		input.dispatchEvent(new Event('input'))
		await flushPromises()
		await click(button('Save name', row(2)))

		expect(nameVersion).toHaveBeenCalledWith(FILE_ID, '100', 'Before rewrite')
		expect(listVersions).toHaveBeenCalledTimes(2)
	})

	it('does not restore and says so when the outline could not be saved first', async () => {
		const flush = vi.fn(async () => false)
		await open({ flush })

		await click(button('Restore', row(2)))

		expect(flush).toHaveBeenCalledTimes(1)
		expect(restoreVersion).not.toHaveBeenCalled()
		expect(document.body.querySelector('[role="alert"]').textContent).toContain('not saved')
	})

	it('shows a message when the list cannot be loaded', async () => {
		listVersions.mockRejectedValue(new Error('offline'))

		await open()

		expect(document.body.querySelector('[role="alert"]').textContent).toBe('Could not load versions.')
	})

	it('shows a message when a restore fails and does not reload', async () => {
		restoreVersion.mockRejectedValue(new Error('locked'))
		const reload = vi.fn(async () => {})
		await open({ reload })

		await click(button('Restore', row(2)))

		expect(document.body.querySelector('[role="alert"]').textContent).toBe('Could not restore this version.')
		expect(reload).not.toHaveBeenCalled()
	})

	it('shows a message when a name cannot be saved', async () => {
		nameVersion.mockRejectedValue(new Error('forbidden'))
		await open()
		await click(button('Name', row(2)))

		await click(button('Save name', row(2)))

		expect(document.body.querySelector('[role="alert"]').textContent).toBe('Could not name this version.')
	})

	it('renders nothing while closed and asks the parent to close from the Close button', async () => {
		wrapper = mount(VersionsPanel, {
			props: { fileId: FILE_ID, open: false, flush: vi.fn(), reload: vi.fn() },
			attachTo: document.body,
		})
		await flushPromises()
		expect(listVersions).not.toHaveBeenCalled()
		expect(document.body.querySelector('li.version-row')).toBeNull()

		await wrapper.setProps({ open: true })
		await flushPromises()
		await click(button('Close'))

		expect(wrapper.emitted('close')).toHaveLength(1)
	})
})
