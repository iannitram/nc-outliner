import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
	plugins: [vue()],
	test: {
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
