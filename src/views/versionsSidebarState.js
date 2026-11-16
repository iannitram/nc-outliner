import { reactive } from 'vue'

/**
 * State shared by the outline view (in the main column) and the versions sidebar, which must sit
 * next to NcAppContent inside NcContent (App.vue). The view fills it in; the sidebar reads it.
 */
export const versionsSidebar = reactive({
	active: false,
	open: false,
	fileId: 0,
	title: '',
	selectedId: null,
	flush: async () => true,
	reload: async () => {},
	onPreview: () => {},
	onRestored: () => {},
	onClose: () => {},
	/** Set by the sidebar: restore one version by id. */
	restore: null,
})

/** Forget the view that was using the sidebar. */
export function resetVersionsSidebar() {
	versionsSidebar.active = false
	versionsSidebar.open = false
	versionsSidebar.selectedId = null
	versionsSidebar.restore = null
}
