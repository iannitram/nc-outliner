import { expect, it, vi } from 'vitest'
import { createHistory } from '../../../src/model/history.js'
import { updateRow } from '../../../src/model/outline.js'

const { get, put } = vi.hoisted(() => ({ get: vi.fn(), put: vi.fn() }))
vi.mock('@nextcloud/axios', () => ({ default: { get, put } }))
vi.mock('@nextcloud/router', () => ({ generateUrl: (path) => path }))

import { readOutline, saveOutline } from '../../../src/api/outlines.js'

it('carries opaque read metadata through an edit, undo, redo and the actual save client', async () => {
	const outline = {
		title: 'Imported',
		publishPath: null,
		headExtra: { dateCreated: '2026-10-01', ownerName: 'Source author' },
		rows: [{ id: 'row', text: 'Original', note: '', collapsed: false, extra: { _status: 'checked', type: 'checkbox' }, children: [] }],
	}
	get.mockResolvedValue({ data: { fileId: 7, name: 'Imported.opml', etag: 'before', outline } })
	put.mockResolvedValue({ data: { etag: 'after' } })
	const loaded = await readOutline(7)
	const history = createHistory(loaded.outline.rows)
	history.execute(updateRow, ['row', { text: 'Edited' }])
	history.undo()
	history.redo()
	await saveOutline(7, { ...loaded.outline, rows: history.current() }, loaded.etag)
	const [url, payload, options] = put.mock.calls[0]
	expect(url).toBe('/apps/nc_outliner/api/outlines/7')
	expect(payload.outline.headExtra).toEqual(outline.headExtra)
	expect(payload.outline.rows[0].extra).toEqual(outline.rows[0].extra)
	expect(payload.outline.rows[0].text).toBe('Edited')
	expect(options.headers['If-Match']).toBe('before')
})
