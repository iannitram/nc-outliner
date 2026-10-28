import { installErrorBuffer } from 'craft-bugreport-web'
import { expect, it, vi } from 'vitest'
import { createApp } from 'vue'

vi.mock('craft-bugreport-web', () => ({ installErrorBuffer: vi.fn(() => ({ lines: () => [], uninstall: () => {} })) }))
vi.mock('vue', () => ({ createApp: vi.fn(() => ({ mount: vi.fn(), use: vi.fn().mockReturnThis() })) }))
vi.mock('../../src/App.vue', () => ({ default: {} }))

it('starts the error buffer once, before creating the app', async () => {
	await import('../../src/main.js')
	expect(installErrorBuffer).toHaveBeenCalledOnce()
	expect(createApp).toHaveBeenCalledOnce()
	expect(installErrorBuffer.mock.invocationCallOrder[0]).toBeLessThan(createApp.mock.invocationCallOrder[0])
})
