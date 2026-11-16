import { installErrorBuffer } from 'craft-bugreport-web'
import { expect, it, vi } from 'vitest'
import { createApp } from 'vue'
import { attachVueErrorHandler, installCrashLog } from '../../src/services/crashLog.js'

vi.mock('craft-bugreport-web', () => ({ installErrorBuffer: vi.fn(() => ({ lines: () => [], uninstall: () => {} })) }))
vi.mock('vue', () => ({ createApp: vi.fn(() => ({ mount: vi.fn(), use: vi.fn().mockReturnThis(), config: {} })) }))
vi.mock('../../src/App.vue', () => ({ default: {} }))
// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
vi.mock('../../src/services/crashLog.js', () => ({ installCrashLog: vi.fn(), attachVueErrorHandler: vi.fn() }))

it('starts the error buffer once, before creating the app', async () => {
	await import('../../src/main.js')
	expect(installErrorBuffer).toHaveBeenCalledOnce()
	expect(createApp).toHaveBeenCalledOnce()
	expect(installErrorBuffer.mock.invocationCallOrder[0]).toBeLessThan(createApp.mock.invocationCallOrder[0])
	// TEMPORARY (#177): the crash log is installed first, and Vue's handler before mount.
	expect(installCrashLog.mock.invocationCallOrder[0]).toBeLessThan(installErrorBuffer.mock.invocationCallOrder[0])
	expect(attachVueErrorHandler).toHaveBeenCalledWith(createApp.mock.results[0].value)
})
