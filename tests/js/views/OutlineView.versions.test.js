import { NcAppContent, NcContent, NcIconSvgWrapper } from '@nextcloud/vue'
import { flushPromises, mount } from '@vue/test-utils'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import OutlineTopBar from '../../../src/components/OutlineTopBar.vue'
import SortDialog from '../../../src/components/SortDialog.vue'
import VersionsSidebar from '../../../src/components/VersionsSidebar.vue'
import OutlineView from '../../../src/views/OutlineView.vue'
import { listOutlines, readOutline, saveOutline } from '../../../src/api/outlines.js'
import { listVersions, nameVersion, readVersion, restoreVersion } from '../../../src/api/versions.js'

vi.mock('@nextcloud/dialogs', () => ({ showSuccess: vi.fn(), showError: vi.fn() }))
vi.mock('../../../src/api/outlines.js', () => ({
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
vi.mock('../../../src/components/PublishButton.vue', () => ({
	default: { name: 'PublishButton', template: '<div class="publish-button-stub" />' },
}))

const current = { id: '300', time: Date.parse('2026-10-28T17:51:38Z'), label: '', size: 3 }
const older = { id: '100', time: Date.parse('2026-10-28T17:51:02Z'), label: '', size: 3 }
const OLD_OPML = `<?xml version="1.0"?>
<opml version="2.0"><body>
<outline text="Old title" _note="old note"><outline text="Old child"/></outline>
</body></opml>`
const outline = {
	title: 'Plan',
	rows: [{ id: 'r1', text: 'Live row', note: '', collapsed: false, noteHidden: false, children: [] }],
	publishPath: null,
}

// The layout of App.vue: the sidebar sits after NcAppContent inside NcContent.
const Host = {
	components: { NcAppContent, NcContent, OutlineView, VersionsSidebar },
	template: '<NcContent appName="t"><NcAppContent><OutlineView :fileId="3" /></NcAppContent><VersionsSidebar /></NcContent>',
}

let wrapper

const versionsButton = () => document.body.querySelector('button[aria-label="Versions"]')
const textButton = (text) => Array.from(document.body.querySelectorAll('button')).find((el) => el.textContent.trim() === text)
async function click(el) {
	el.click()
	await flushPromises()
}
async function openSidebar() {
	await click(versionsButton())
}
async function preview() {
	await openSidebar()
	await click(document.body.querySelectorAll('li.version-row .version-select')[1])
}

beforeEach(() => {
	vi.clearAllMocks()
	readOutline.mockResolvedValue({ fileId: 3, name: 'Plan.opml', etag: 'etag-1', outline })
	saveOutline.mockResolvedValue({ ok: true, etag: 'etag-2' })
	listVersions.mockResolvedValue([current, older])
	listOutlines.mockResolvedValue([{ fileId: 3, name: 'Plan', mtime: current.time / 1000 }])
	readVersion.mockResolvedValue(OLD_OPML)
	restoreVersion.mockResolvedValue()
	nameVersion.mockResolvedValue()
	wrapper = mount(Host, { attachTo: document.body })
	return flushPromises()
})

afterEach(() => {
	wrapper.unmount()
	document.body.innerHTML = ''
})

describe('OutlineView: versions in the sidebar with a read-only preview (#185)', () => {
	it('toggles the sidebar with the clock button, which keeps the name "Versions"', async () => {
		expect(document.body.querySelector('aside.app-sidebar')).toBeNull()

		await openSidebar()
		expect(document.body.querySelector('aside.app-sidebar')).not.toBeNull()
		expect(document.body.querySelector('aside.app-sidebar').textContent).toContain('Versions')
		expect(document.body.querySelector('[role="dialog"]')).toBeNull()

		await click(versionsButton())
		expect(document.body.querySelector('aside.app-sidebar')).toBeNull()
	})

	it('renders the sidebar inside NcContent, after NcAppContent, not teleported', async () => {
		await openSidebar()

		const aside = document.body.querySelector('aside.app-sidebar')
		const content = document.body.querySelector('#content-vue')
		expect(content.contains(aside)).toBe(true)
		expect(document.body.querySelector('#app-sidebar-vue').closest('#content-vue')).toBe(content)
		const main = content.querySelector('main, .app-content')
		expect(main.compareDocumentPosition(aside) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
	})

	it('draws every icon with a size, and no big icon in a preview', async () => {
		await preview()

		// Every svg is drawn by NcIconSvgWrapper, which sizes it; none is a raw, unsized svg.
		const svgs = Array.from(document.body.querySelectorAll('.version-banner svg, .version-text svg'))
		expect(svgs.length).toBeGreaterThan(0)
		svgs.forEach((svg) => expect(svg.closest('.icon-vue')).not.toBeNull())
		const icons = wrapper.findAllComponents(NcIconSvgWrapper)
		expect(icons.length).toBeGreaterThan(0)
		icons.forEach((icon) => expect(icon.props('size')).toBeLessThanOrEqual(20))
		expect(versionsButton().querySelector('svg')).not.toBeNull()
	})

	it('shows a clicked version read-only, with its levels and notes, under the banner', async () => {
		await preview()

		const banner = document.body.querySelector('.version-banner')
		expect(banner.textContent).toContain('Read-only')
		expect(textButton('Restore this version')).toBeTruthy()
		expect(textButton('Back to current')).toBeTruthy()
		const rows = Array.from(document.body.querySelectorAll('.outline-row'))
		expect(rows.map((el) => el.querySelector('.outline-row__input').value)).toEqual(['Old title', 'Old child'])
		expect(rows[0].classList.contains('level-1')).toBe(true)
		expect(rows[0].querySelector('.outline-row__note').value).toBe('old note')
		expect(document.body.textContent).not.toContain('Live row')
		// Nothing is editable, draggable or addable.
		document.body.querySelectorAll('.outline-row input, .outline-row textarea').forEach((el) => expect(el.readOnly).toBe(true))
		expect(document.body.querySelector('[draggable="true"], .outline-row__handle, .outline-sort')).toBeNull()
		expect(textButton('Add note')).toBeUndefined()
		expect(saveOutline).not.toHaveBeenCalled()
	})

	it('does not change a read-only row on typing or Enter', async () => {
		await preview()
		const input = document.body.querySelector('.outline-row__input')

		input.value = 'Changed'
		input.dispatchEvent(new Event('input', { bubbles: true }))
		input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }))
		await flushPromises()

		expect(document.body.querySelectorAll('.outline-row')).toHaveLength(2)
		expect(saveOutline).not.toHaveBeenCalled()
	})

	it('offers no sort while a version is previewed, so the hidden current outline is not changed', async () => {
		await preview()
		const topBar = wrapper.findComponent(OutlineTopBar)

		expect(topBar.props('sortDisabled')).toBe(true)
		topBar.vm.$emit('openSort')
		await flushPromises()

		expect(wrapper.findComponent(SortDialog).props('open')).toBe(false)
		expect(saveOutline).not.toHaveBeenCalled()

		await click(textButton('Back to current'))
		expect(topBar.props('sortDisabled')).toBe(false)
	})

	it('says "This version can\'t be opened" instead of raw text when the version is not OPML', async () => {
		readVersion.mockResolvedValue('<!DOCTYPE html><html><body>Login</body></html>')
		await preview()

		expect(document.body.querySelector('.version-banner')).not.toBeNull()
		expect(document.body.textContent).toContain("This version can't be opened")
		expect(textButton('Restore this version')).toBeUndefined()
		expect(document.body.querySelector('.outline-row')).toBeNull()
		expect(document.body.textContent).not.toContain('Login')
	})

	it('"Back to current" returns to the editor, keeping the sidebar open', async () => {
		await preview()

		await click(textButton('Back to current'))

		expect(document.body.querySelector('.version-banner')).toBeNull()
		expect(document.body.querySelector('.outline-row__input').value).toBe('Live row')
		expect(document.body.querySelector('.outline-row__input').readOnly).toBe(false)
		expect(document.body.querySelector('aside.app-sidebar')).not.toBeNull()
	})

	it('"Restore this version" saves first, restores, returns to the editor and shows the green naming offer', async () => {
		await preview()
		readOutline.mockResolvedValue({ fileId: 3, name: 'Plan.opml', etag: 'etag-9', outline })
		listVersions.mockResolvedValue([current, older])

		await click(textButton('Restore this version'))

		expect(restoreVersion).toHaveBeenCalledWith(3, '100')
		expect(document.body.querySelector('.version-banner')).toBeNull()
		expect(document.body.querySelector('.outline-row__input').value).toBe('Live row')
		expect(document.body.querySelector('.notecard--success .version-offer')).not.toBeNull()
	})

	it('Escape closes the sidebar and the preview goes back to the current outline', async () => {
		await preview()

		document.body.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
		await flushPromises()

		expect(document.body.querySelector('aside.app-sidebar')).toBeNull()
		expect(document.body.querySelector('.version-banner')).toBeNull()
		expect(document.body.querySelector('.outline-row__input').value).toBe('Live row')
	})
})
