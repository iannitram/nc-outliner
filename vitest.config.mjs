import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [vue()],
	test: {
		// Use worker threads to avoid fork start-up timeouts on the Windows runner.
		pool: process.env.CI && process.platform === 'win32' ? 'threads' : undefined,
		// Bound worker startup on shared CI runners while retaining file isolation.
		maxWorkers: process.env.CI && process.platform === 'win32' ? 1 : (process.env.CI ? 2 : undefined),
		environment: 'jsdom',
		include: ['tests/js/**/*.test.js'],
		css: {
			// @nextcloud/vue imports its own CSS; let Vite process it instead of Node.
			include: [/@nextcloud/],
		},
		server: {
			deps: {
				inline: [/@nextcloud/],
			},
		},
	},
})
