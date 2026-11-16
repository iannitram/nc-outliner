import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import VersionsPanel from '../../../src/components/VersionsPanel.vue'
import { listOutlines } from '../../../src/api/outlines.js'
import { listVersions, nameVersion, readVersion, restoreVersion } from '../../../src/api/versions.js'

vi.mock('../../../src/api/outlines.js', () => ({
	listOutlines: vi.fn(),
}))

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
// Restoring `older` (100) from the live file (300): the pre-restore state stays as version 300, and the file's
// mtime becomes 100's id (NC 33).

let wrapper
let calls
let liveMtime

function formatted(ms) {
	return new Date(ms).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' })
}
function rows() {
	return Array.from(document.body.querySelectorAll('li.version-row'))
}
function row(index) {
	return rows()[index]
}
/** Open a row's ... menu and return the menu item with this text (or undefined when the menu has none). */
async function menuItem(rowIndex, text) {
	const trigger = row(rowIndex).querySelector('button[aria-haspopup]')
	if (trigger.getAttribute('aria-expanded') !== 'true') {
		trigger.click()
	}
	// The menu opens on a later tick; wait until this trigger's menu has items.
	await vi.waitFor(() => expect(trigger.getAttribute('aria-expanded')).toBe('true'))
	await vi.waitFor(() => expect(document.body.querySelector('[role="menuitem"]')).not.toBeNull())
	await new Promise((resolve) => setTimeout(resolve, 30))
	await flushPromises()
	return Array.from(document.body.querySelectorAll('[role="menuitem"]')).find((el) => el.textContent.trim() === text)
}
async function restoreVia(rowIndex) {
	await click(await menuItem(rowIndex, 'Restore'))
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
	// The live file's mtime (seconds), as the outline list reports it.
	liveMtime = current.time / 1000
	listOutlines.mockImplementation(async () => [{ fileId: FILE_ID, name: 'Untitled', mtime: liveMtime }])
	readVersion.mockResolvedValue('old text of the outline')
	restoreVersion.mockImplementation(async (fileId, id) => {
		calls.push('restore')
		// NC 33: the file's mtime becomes the restored version's id.
		liveMtime = Number(id)
	})
	nameVersion.mockResolvedValue()
})

afterEach(() => {
	wrapper?.unmount()
	wrapper = undefined
	document.body.innerHTML = ''
})

const OPML = '<opml><body><outline text="old text of the outline"/></body></opml>'

describe('VersionsPanel.vue', () => {
	it('lists names and times newest first and marks the current entry first', async () => {
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
		// The current file has no menu (nothing to restore); older entries have Restore and Name this version.
		expect(row(0).querySelector('button[aria-haspopup]')).toBeNull()
		expect(await menuItem(1, 'Restore')).toBeTruthy()
		expect(await menuItem(1, 'Name this version')).toBeTruthy()
	})

	it('puts Current first and groups the rest Today / Yesterday / Earlier by local date', async () => {
		vi.useFakeTimers({ toFake: ['Date'] })
		vi.setSystemTime(new Date(2026, 9, 28, 15, 0, 0))
		const local = (...args) => new Date(...args).getTime()
		const list = [
			{ id: '50', time: local(2026, 9, 28, 14, 2), label: '', size: 3 },
			{ id: '40', time: local(2026, 9, 28, 9, 15), label: '', size: 3 },
			{ id: '30', time: local(2026, 9, 27, 17, 40), label: 'Before restructure', size: 3 },
			{ id: '20', time: local(2026, 9, 21, 16, 30), label: '', size: 3 },
			{ id: '10', time: local(2026, 9, 20, 10, 12), label: 'First draft', size: 3 },
		]
		listVersions.mockImplementation(async () => list)
		// The 09:15 entry is the live file, though it is not the newest: Current is still listed first.
		listOutlines.mockImplementation(async () => [{ fileId: FILE_ID, name: 'Untitled', mtime: list[1].time / 1000 }])
		try {
			await open()

			const items = Array.from(document.body.querySelectorAll('ol.version-list > li'))
			const kinds = items.map((el) => (el.classList.contains('version-group') ? `# ${el.textContent.trim()}` : el.querySelector('time').getAttribute('datetime')))
			expect(kinds).toEqual([
				new Date(list[1].time).toISOString(),
				'# Today',
				new Date(list[0].time).toISOString(),
				'# Yesterday',
				new Date(list[2].time).toISOString(),
				'# Earlier',
				new Date(list[3].time).toISOString(),
				new Date(list[4].time).toISOString(),
			])
			expect(items[0].textContent).toContain('Current')
		} finally {
			vi.useRealTimers()
		}
	})

	it('shows a named version\'s name as a tag, and nothing for an unnamed one', async () => {
		await open()

		expect(row(1).querySelector('.version-name').textContent.trim()).toBe('Before rewrite')
		expect(row(1).querySelector('.version-name svg')).not.toBeNull()
		expect(row(2).querySelector('.version-name')).toBeNull()
	})

	it('asks the view to show a version read-only when its row is clicked, and Current when the live row is', async () => {
		readVersion.mockResolvedValue(OPML)
		await open()

		await click(row(2).querySelector('.version-select'))

		expect(readVersion).toHaveBeenCalledWith(FILE_ID, '100')
		const [payload] = wrapper.emitted('preview')[0]
		expect(payload).toMatchObject({ id: '100', time: older.time })
		expect(payload.tree).toEqual([expect.objectContaining({ text: 'old text of the outline', children: [] })])
		expect(restoreVersion).not.toHaveBeenCalled()

		await click(row(0).querySelector('.version-select'))
		expect(wrapper.emitted('preview')[1]).toEqual([null])
	})

	it('marks the selected version', async () => {
		await open({ selectedId: '100' })

		expect(row(2).querySelector('.version-select').getAttribute('aria-current')).toBe('true')
		expect(row(2).textContent).toContain('Showing')
		expect(row(0).querySelector('.version-select').getAttribute('aria-current')).toBeNull()
	})

	it('flushes before restoring, then reloads the outline, then offers to name the new top entry', async () => {
		const flush = vi.fn(async () => {
			calls.push('flush')
			return true
		})
		const reload = vi.fn(async () => {
			calls.push('reload')
		})
		await open({ flush, reload })

		await restoreVia(2)

		expect(restoreVersion).toHaveBeenCalledWith(FILE_ID, '100')
		expect(flush).toHaveBeenCalledTimes(1)
		expect(reload).toHaveBeenCalledTimes(1)
		expect(calls).toEqual(['list', 'flush', 'restore', 'reload', 'list'])
		expect(wrapper.emitted('restored')).toHaveLength(1)

		const offer = document.body.querySelector('.version-offer')
		expect(offer).not.toBeNull()
		expect(offer.closest('.notecard--success')).not.toBeNull()
		expect(field('Name for the state before the restore', offer).value).toMatch(/^Before restore .+/)
	})

	it('names the new top entry when the naming offer is accepted', async () => {
		await open()
		await restoreVia(2)
		const offer = document.body.querySelector('.version-offer')
		const defaultLabel = field('Name for the state before the restore', offer).value

		await click(button('Save name', offer))

		expect(nameVersion).toHaveBeenCalledTimes(1)
		expect(nameVersion).toHaveBeenCalledWith(FILE_ID, '300', defaultLabel)
		expect(document.body.querySelector('.version-offer')).toBeNull()
	})

	it('removes the naming offer when it is dismissed, without naming anything', async () => {
		await open()
		await restoreVia(2)

		await click(button('Dismiss', document.body.querySelector('.version-offer')))

		expect(nameVersion).not.toHaveBeenCalled()
		expect(document.body.querySelector('.version-offer')).toBeNull()
	})

	it('names an older entry in place: a field in its row, Enter saves', async () => {
		await open()

		await click(await menuItem(2, 'Name this version'))
		const input = field('Version name', row(2))
		input.value = 'Before rewrite'
		input.dispatchEvent(new Event('input'))
		await flushPromises()
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
		await flushPromises()

		expect(nameVersion).toHaveBeenCalledWith(FILE_ID, '100', 'Before rewrite')
		expect(listVersions).toHaveBeenCalledTimes(2)
		expect(row(2).querySelector('.version-rename')).toBeNull()
	})

	it('names with the Save name button too, and Escape in the field cancels without closing the sidebar', async () => {
		await open()
		await click(await menuItem(2, 'Name this version'))
		const input = field('Version name', row(2))

		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true, cancelable: true }))
		await flushPromises()

		expect(row(2).querySelector('.version-rename')).toBeNull()
		expect(nameVersion).not.toHaveBeenCalled()
		expect(wrapper.emitted('close')).toBeUndefined()

		await click(await menuItem(2, 'Name this version'))
		await click(button('Save name', row(2)))
		expect(nameVersion).toHaveBeenCalledWith(FILE_ID, '100', '')
	})

	it('does not restore and says so when the outline could not be saved first', async () => {
		const flush = vi.fn(async () => false)
		await open({ flush })

		await restoreVia(2)

		expect(flush).toHaveBeenCalledTimes(1)
		expect(restoreVersion).not.toHaveBeenCalled()
		expect(wrapper.emitted('restored')).toBeUndefined()
		expect(document.body.querySelector('[role="alert"]').textContent).toContain('not saved')
	})

	it('does not restore when saving the pending edits fails outright', async () => {
		const flush = vi.fn().mockRejectedValue(new Error('offline'))
		const reload = vi.fn(async () => {})
		await open({ flush, reload })

		await restoreVia(2)

		expect(restoreVersion).not.toHaveBeenCalled()
		expect(reload).not.toHaveBeenCalled()
		expect(document.body.querySelector('[role="alert"]').textContent).toBe('Could not restore this version.')
	})

	it('asks the parent to close when Escape is pressed', async () => {
		await open()

		document.activeElement.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		await flushPromises()

		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('asks the parent to close when Escape is pressed inside the sidebar', async () => {
		await open()

		row(1).querySelector('.version-select').dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		await flushPromises()

		expect(wrapper.emitted('close')).toHaveLength(1)
	})

	it('asks the parent to close from the sidebar close button', async () => {
		await open()

		await click(document.body.querySelector('.app-sidebar-header__close, button[aria-label="Close sidebar"]'))

		expect(wrapper.emitted('close')).toHaveLength(1)
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

		await restoreVia(2)

		expect(document.body.querySelector('[role="alert"]').textContent).toBe('Could not restore this version.')
		expect(reload).not.toHaveBeenCalled()
	})

	it('shows a message when a name cannot be saved', async () => {
		nameVersion.mockRejectedValue(new Error('forbidden'))
		await open()
		await click(await menuItem(2, 'Name this version'))

		await click(button('Save name', row(2)))

		expect(document.body.querySelector('[role="alert"]').textContent).toBe('Could not name this version.')
	})

	it('renders nothing while closed, and loads the list when it opens', async () => {
		wrapper = mount(VersionsPanel, {
			props: { fileId: FILE_ID, open: false, flush: vi.fn(), reload: vi.fn() },
			attachTo: document.body,
		})
		await flushPromises()
		expect(listVersions).not.toHaveBeenCalled()
		expect(document.body.querySelector('li.version-row')).toBeNull()
		expect(document.body.querySelector('aside')).toBeNull()

		await wrapper.setProps({ open: true })
		await flushPromises()

		expect(document.body.querySelector('aside')).not.toBeNull()
		expect(rows()).toHaveLength(3)
	})

	it('after a restore, labels Current by the file mtime, not the newest entry, and keeps its menu', async () => {
		// The restored-from version (100) is now the live file; the pre-restore state is newest and readable.
		listOutlines.mockImplementation(async () => [{ fileId: FILE_ID, name: 'Untitled', mtime: older.time / 1000 }])
		await open()

		// Current is listed first, whichever entry it is.
		expect(row(0).textContent).toContain('Current')
		expect(row(0).querySelector('time').getAttribute('datetime')).toBe(new Date(older.time).toISOString())
		expect(row(1).textContent).not.toContain('Current')
		expect(await menuItem(1, 'Restore')).toBeTruthy()
	})

	it('puts Current on none if no entry matches the file mtime', async () => {
		listOutlines.mockImplementation(async () => [{ fileId: FILE_ID, name: 'Untitled', mtime: 12345 }])
		await open()

		expect(rows().map((el) => el.textContent.includes('Current'))).toEqual([false, false, false])
	})

	it('marks a version whose read fails as unreadable, and gives it no Restore', async () => {
		readVersion.mockRejectedValue(Object.assign(new Error('Request failed with status code 500'), { response: { status: 500 } }))
		await open()

		await click(row(1).querySelector('.version-select'))

		expect(row(1).textContent).toContain("This version can't be opened")
		expect(await menuItem(1, 'Restore')).toBeUndefined()
		expect(await menuItem(1, 'Name this version')).toBeTruthy()
		expect(await menuItem(2, 'Restore')).toBeTruthy()
		expect(wrapper.emitted('preview')[0][0]).toMatchObject({ id: '200', tree: null })
		expect(restoreVersion).not.toHaveBeenCalled()
	})

	it('marks a version that is not OPML as unreadable, and sends no text', async () => {
		readVersion.mockResolvedValue('<!DOCTYPE html><html><body>Login</body></html>')
		await open()

		await click(row(2).querySelector('.version-select'))

		expect(row(2).textContent).toContain("This version can't be opened")
		expect(wrapper.emitted('preview')[0][0].tree).toBeNull()
		expect(document.body.innerHTML).not.toContain('Login')
	})

	describe('naming the state from before a restore (NC 33: its id is the file mtime before the restore)', () => {
		const A = { id: '1793211107', time: 1793211107000, label: '', size: 3 } // alpha / "alpha one"
		const ABG = { id: '1793211135', time: 1793211135000, label: '', size: 3 } // alpha, beta, gamma

		it('restore #2: names 1793211107, the file mtime before, not the newest or the live id', async () => {
			liveMtime = 1793211107
			listVersions.mockImplementation(async () => [ABG, A])
			await open()
			expect(row(0).textContent).toContain('Current')

			await restoreVia(1)

			expect(restoreVersion).toHaveBeenCalledWith(FILE_ID, '1793211135')
			const offer = document.body.querySelector('.version-offer')
			expect(offer.textContent).toContain(formatted(A.time))
			await click(button('Save name', offer))
			expect(nameVersion).toHaveBeenCalledTimes(1)
			expect(nameVersion).toHaveBeenCalledWith(FILE_ID, 1793211107 + '', expect.stringMatching(/^Before restore /))
			expect(nameVersion).not.toHaveBeenCalledWith(FILE_ID, '1793211135', expect.anything())
		})

		it('restore #1: names 1793211135, the file mtime before', async () => {
			liveMtime = 1793211135
			listVersions.mockImplementation(async () => [ABG, A])
			await open()

			await restoreVia(1)

			expect(restoreVersion).toHaveBeenCalledWith(FILE_ID, '1793211107')
			await click(button('Save name', document.body.querySelector('.version-offer')))
			expect(nameVersion).toHaveBeenCalledWith(FILE_ID, '1793211135', expect.any(String))
		})

		it('says so, and offers nothing to name, when the pre-restore id is not in the refreshed list', async () => {
			liveMtime = 1793211000
			listVersions.mockImplementation(async () => [ABG, A])
			await open()

			await restoreVia(1)

			expect(document.body.querySelector('.version-offer')).toBeNull()
			expect(document.body.textContent).toContain('could not be found')
			expect(nameVersion).not.toHaveBeenCalled()
		})
	})
})
