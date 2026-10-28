import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createSaver } from '../../../src/editor/saver.js'

describe('createSaver', () => {
	beforeEach(() => vi.useFakeTimers())
	afterEach(() => vi.useRealTimers())

	it('saves once after the last scheduled change and flushes immediately', async () => {
		const save = vi.fn().mockResolvedValue({ ok: true })
		const saver = createSaver({ save })
		saver.schedule({ value: 1 })
		await vi.advanceTimersByTimeAsync(1000)
		saver.schedule({ value: 2 })
		await vi.advanceTimersByTimeAsync(1499)
		expect(save).not.toHaveBeenCalled()
		await vi.advanceTimersByTimeAsync(1)
		expect(save).toHaveBeenCalledWith({ value: 2 })
		saver.schedule({ value: 3 })
		await saver.flush()
		expect(save).toHaveBeenLastCalledWith({ value: 3 })
	})

	it('queues the latest document edited during a save', async () => {
		let finish
		const save = vi.fn()
			.mockImplementationOnce(() => new Promise((resolve) => { finish = resolve }))
			.mockResolvedValue({ ok: true })
		const saver = createSaver({ save })
		saver.schedule('first')
		expect(saver.isDirty()).toBe(true)
		const first = saver.flush()
		saver.schedule('second')
		finish({ ok: true })
		await first
		expect(save).toHaveBeenCalledTimes(2)
		expect(save).toHaveBeenLastCalledWith('second')
		expect(saver.isDirty()).toBe(false)
	})

	it('retries failures and stops on a conflict', async () => {
		const save = vi.fn().mockRejectedValueOnce(Error('offline')).mockResolvedValueOnce({ conflict: true, etag: 'new' })
		const onConflict = vi.fn()
		const saver = createSaver({ save, onConflict })
		saver.schedule('doc')
		await vi.advanceTimersByTimeAsync(1500)
		expect(saver.status()).toBe('error')
		await vi.advanceTimersByTimeAsync(1999)
		expect(save).toHaveBeenCalledTimes(1)
		await vi.advanceTimersByTimeAsync(1)
		expect(saver.status()).toBe('conflict')
		expect(saver.isDirty()).toBe(true)
		expect(onConflict).toHaveBeenCalledWith({ conflict: true, etag: 'new' })
		saver.schedule('later')
		await vi.advanceTimersByTimeAsync(10000)
		expect(save).toHaveBeenCalledTimes(2)
	})
})
