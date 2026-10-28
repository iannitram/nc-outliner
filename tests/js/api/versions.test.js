import { beforeEach, describe, expect, it, vi } from 'vitest'

const { axios } = vi.hoisted(() => ({
	axios: { request: vi.fn(), get: vi.fn() },
}))

vi.mock('@nextcloud/axios', () => ({ default: axios }))
vi.mock('@nextcloud/auth', () => ({ getCurrentUser: () => ({ uid: 'ann' }) }))
vi.mock('@nextcloud/router', () => ({
	generateRemoteUrl: (service) => `https://cloud.example/remote.php/${service}`,
}))

import {
	listVersions,
	nameVersion,
	readVersion,
	restoreVersion,
} from '../../../src/api/versions.js'

const base = 'https://cloud.example/remote.php/dav/versions/ann'

function multistatus(entries) {
	return `<?xml version="1.0"?>
<d:multistatus xmlns:d="DAV:" xmlns:nc="http://nextcloud.org/ns">
<d:response><d:href>/remote.php/dav/versions/ann/versions/7/</d:href><d:propstat><d:prop/><d:status>HTTP/1.1 404 Not Found</d:status></d:propstat></d:response>
${entries.map(([id, time, label, size]) => `<d:response><d:href>/remote.php/dav/versions/ann/versions/7/${id}</d:href><d:propstat><d:prop><d:getlastmodified>${time}</d:getlastmodified><d:getcontentlength>${size}</d:getcontentlength>${label ? `<nc:version-label>${label}</nc:version-label>` : ''}</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response>`).join('\n')}
</d:multistatus>`
}

describe('versions client', () => {
	beforeEach(() => {
		vi.clearAllMocks()
	})

	it('lists versions newest first with time and label', async () => {
		axios.request.mockResolvedValue({ data: multistatus([
			['100', 'Wed, 28 Oct 2026 17:51:34 GMT', '', 3],
			['300', 'Wed, 28 Oct 2026 17:51:38 GMT', 'keep me', 3],
		]) })

		const versions = await listVersions(7)

		expect(axios.request).toHaveBeenCalledWith(expect.objectContaining({
			method: 'PROPFIND',
			url: `${base}/versions/7`,
			headers: expect.objectContaining({ Depth: '1' }),
		}))
		expect(versions).toEqual([
			{ id: '300', time: Date.UTC(2026, 9, 28, 17, 51, 38), label: 'keep me', size: 3 },
			{ id: '100', time: Date.UTC(2026, 9, 28, 17, 51, 34), label: '', size: 3 },
		])
	})

	it('reads one version as text', async () => {
		axios.get.mockResolvedValue({ data: '<opml/>' })

		await expect(readVersion(7, '100')).resolves.toBe('<opml/>')
		expect(axios.get).toHaveBeenCalledWith(`${base}/versions/7/100`, { responseType: 'text', transformResponse: [expect.any(Function)] })
	})

	it('restores with a MOVE to the restore target', async () => {
		axios.request.mockResolvedValue({ status: 201 })

		await restoreVersion(7, '100')

		expect(axios.request).toHaveBeenCalledWith({
			method: 'MOVE',
			url: `${base}/versions/7/100`,
			headers: { Destination: `${base}/restore/target` },
		})
	})

	it('names a version with a PROPPATCH of the label', async () => {
		axios.request.mockResolvedValue({ status: 207 })

		await nameVersion(7, '100', 'Before the rewrite <1>')

		const call = axios.request.mock.calls[0][0]
		expect(call.method).toBe('PROPPATCH')
		expect(call.url).toBe(`${base}/versions/7/100`)
		expect(call.data).toContain('<nc:version-label>Before the rewrite &lt;1&gt;</nc:version-label>')
	})
})
