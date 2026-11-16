<script setup>
import { computed, ref } from 'vue'
import { isMac } from '../editor/keymap.js'

const props = defineProps({
	/** How many rows the outline has, at every level. */
	rowCount: {
		type: Number,
		default: 0,
	},
})

/** The card hides itself once the outline has this many rows. */
const HIDE_AT_ROWS = 5
const STORAGE_KEY = 'nc_outliner.keyboardHintsHidden'

/**
 * @return {boolean} whether "Hide" was chosen earlier in this browser
 */
function readHidden() {
	try {
		return globalThis.localStorage?.getItem(STORAGE_KEY) === '1'
	} catch {
		return false
	}
}

const hidden = ref(readHidden())
const mac = isMac()
const mod = mac ? '⌘' : 'Ctrl'
const alt = mac ? '⌥' : 'Alt'
const visible = computed(() => !hidden.value && props.rowCount < HIDE_AT_ROWS)

/** Hide the card and remember that in this browser. */
function hide() {
	hidden.value = true
	try {
		globalThis.localStorage?.setItem(STORAGE_KEY, '1')
	} catch {
		// Storage can be blocked; the card stays hidden for this page view only.
	}
}
</script>

<template>
	<aside
		v-if="visible"
		class="keyboard-hints"
		aria-label="Keyboard">
		<div class="keyboard-hints__head">
			<span>Keyboard</span>
			<button type="button" class="keyboard-hints__hide" @click="hide">
				Hide
			</button>
		</div>
		<div><kbd>Enter</kbd> new row</div>
		<div><kbd>Tab</kbd> indent</div>
		<div><kbd>Shift</kbd><kbd>Tab</kbd> outdent</div>
		<div><kbd>{{ alt }}</kbd><kbd>↑</kbd><kbd>↓</kbd> move row</div>
		<div><kbd>←</kbd><kbd>→</kbd> fold or unfold</div>
		<div><kbd>{{ mod }}</kbd><kbd>Z</kbd> undo</div>
	</aside>
</template>

<style scoped>
.keyboard-hints {
	margin: 22px 8px 8px 34px;
	padding: 14px 16px;
	border-radius: var(--border-radius-container, 8px);
	background: var(--color-background-hover);
	color: var(--color-text-maxcontrast);
	font-size: 13.5px;
	display: grid;
	grid-template-columns: repeat(3, minmax(0, 1fr));
	gap: 8px 18px;
}

@media (max-width: 600px) {
	.keyboard-hints {
		grid-template-columns: repeat(2, minmax(0, 1fr));
		margin-left: 8px;
	}
}

.keyboard-hints__head {
	grid-column: 1 / -1;
	display: flex;
	justify-content: space-between;
	color: var(--color-main-text);
	font-weight: 600;
	font-size: 13.5px;
}

.keyboard-hints__hide {
	background: transparent;
	border: 0;
	padding: 0;
	font: inherit;
	font-weight: 500;
	color: var(--color-text-maxcontrast);
	cursor: pointer;
}

.keyboard-hints__hide:hover {
	color: var(--color-main-text);
	text-decoration: underline;
}

kbd {
	font: inherit;
	font-size: 11.5px;
	font-weight: 600;
	line-height: 1;
	padding: 3px 6px;
	border-radius: 5px;
	background: var(--color-main-background);
	border: 1px solid var(--color-border-maxcontrast);
	color: var(--color-main-text);
	margin-right: 3px;
}
</style>
