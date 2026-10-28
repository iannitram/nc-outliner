import { beforeEach, describe, expect, it, vi } from 'vitest'

const { axios } = vi.hoisted(() => ({
	axios: {
		get: vi.fn(),
		post: vi.fn(),
		put: vi.fn(),
	},
}))

vi.mock('@nextcloud/axios', () => ({ default: axios }))
vi.mock('@nextcloud/router', () => ({
	generateUrl: (path) => `/index.php${path}`,
}))

import {
	createOutline,
	getSettings,
	listOutlines,
	readOutline,
	saveCopy,
	saveOutline,
	setSettings,
} from '../../../src/api/outlines.js'

const outlinesUrl = '/index.php/apps/nc_outliner/api/outlines'
const outline = { title: 'Plan', rows: [], publishPath: null }
const settingsUrl = '/index.php/apps/nc_outliner/api/settings'

describe('outlines API client', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('lists outlines', async () => {
		const outlines = [{ fileId: 7, name: 'Plan', mtime: 1 }]
		axios.get.mockResolvedValue({ data: outlines })

		await expect(listOutlines()).resolves.toEqual(outlines)
		expect(axios.get).toHaveBeenCalledWith(outlinesUrl)
	})

	it('reads and saves the per-user theme setting', async () => {
		axios.get.mockResolvedValue({ data: { theme: 'auto' } })
		axios.put.mockResolvedValue({ data: { theme: 'dark' } })
		await expect(getSettings()).resolves.toEqual({ theme: 'auto' })
		await expect(setSettings('dark')).resolves.toEqual({ theme: 'dark' })
		expect(axios.get).toHaveBeenCalledWith(settingsUrl)
		expect(axios.put).toHaveBeenCalledWith(settingsUrl, { theme: 'dark' })
	})

	it('creates an outline', async () => {
		const created = { fileId: 7, name: 'Plan', etag: 'e1' }
		axios.post.mockResolvedValue({ data: created })

		await expect(createOutline('Plan')).resolves.toEqual(created)
		expect(axios.post).toHaveBeenCalledWith(outlinesUrl, { name: 'Plan' })
	})

	it('reads an outline', async () => {
		const loaded = { fileId: 7, name: 'Plan', etag: 'e1', outline }
		axios.get.mockResolvedValue({ data: loaded })

		await expect(readOutline(7)).resolves.toEqual(loaded)
		expect(axios.get).toHaveBeenCalledWith(`${outlinesUrl}/7`)
	})

	it('saves an outline with its etag', async () => {
		axios.put.mockResolvedValue({ data: { etag: 'e2' } })

		await expect(saveOutline(7, outline, 'e1')).resolves.toEqual({ ok: true, etag: 'e2' })
		expect(axios.put).toHaveBeenCalledWith(`${outlinesUrl}/7`, { outline }, {
			headers: { 'If-Match': 'e1' },
		})
	})

	it('returns the current etag when a save conflicts', async () => {
		axios.put.mockRejectedValue({ response: { status: 412, data: { etag: 'e9' } } })

		await expect(saveOutline(7, outline, 'e1')).resolves.toEqual({ conflict: true, etag: 'e9' })
	})

	it('rethrows other save errors and saves copies', async () => {
		const error = { response: { status: 500 } }
		axios.put.mockRejectedValue(error)
		axios.post.mockResolvedValue({ data: { fileId: 8, name: 'Plan (my copy)', etag: 'e3' } })

		await expect(saveOutline(7, outline, 'e1')).rejects.toBe(error)
		await saveCopy(7, outline)
		expect(axios.post).toHaveBeenCalledWith(`${outlinesUrl}/7/copy`, { outline })
	})
})
