import { beforeEach } from 'vitest'

// App.vue renders a page-level host for the dialogs. Tests that mount a dialog
// need the same target, or NcDialog's teleport has nowhere to go.
beforeEach(() => {
	if (!document.getElementById('nc-outliner-dialogs')) {
		const host = document.createElement('div')
		host.id = 'nc-outliner-dialogs'
		document.body.append(host)
	}
})

// jsdom has no ResizeObserver, which NcActions' popover (floating-vue) and NcAppSidebar use.
globalThis.ResizeObserver ??= class {
	observe() {}
	unobserve() {}
	disconnect() {}
}
