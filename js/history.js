/**
 * Create a history stack with undo/redo functionality and typing coalescing.
 * 
 * @param {any} initial - The initial state
 * @param {Object} options - Configuration options
 * @param {number} options.limit - Maximum number of states to keep (default: 200)
 * @param {number} options.coalesceMs - Time window for coalescing changes (default: 1000)
 * @param {function} options.now - Function to get current time (default: Date.now)
 * @returns {Object} History controller with push, undo, redo, current, canUndo, canRedo methods
 */
export function createHistory(initial, { limit = 200, coalesceMs = 1000, now = () => Date.now() } = {}) {
	// State variables
	let cur = initial;
	let past = [];
	let future = [];
	let lastKey = null;
	let lastAt = 0;

	return {
		/**
		 * Add a new state to history
		 * @param {any} doc - The document state to add
		 * @param {string|null} key - Key identifying the type of change (for coalescing)
		 */
		push(doc, key = null) {
			// Do nothing if no change
			if (doc === cur) return;
			
			const t = now();
			
			// Coalesce changes if within time window and same key
			if (key !== null && key === lastKey && t - lastAt <= coalesceMs) {
				cur = doc;
				lastAt = t;
				future = [];
				return;
			}
			
			// Add current state to past history
			past.push(cur);
			
			// Remove oldest if limit exceeded
			if (past.length > limit) {
				past.shift();
			}
			
			// Update state
			cur = doc;
			future = [];
			lastKey = key;
			lastAt = t;
		},

		/**
		 * Undo the last change
		 * @returns {any|null} The previous state or null if nothing to undo
		 */
		undo() {
			if (past.length === 0) return null;
			
			future.push(cur);
			cur = past.pop();
			lastKey = null;
			return cur;
		},

		/**
		 * Redo the last undone change
		 * @returns {any|null} The next state or null if nothing to redo
		 */
		redo() {
			if (future.length === 0) return null;
			
			past.push(cur);
			cur = future.pop();
			lastKey = null;
			return cur;
		},

		/**
		 * Get the current state
		 * @returns {any} The current state
		 */
		current() {
			return cur;
		},

		/**
		 * Check if undo is possible
		 * @returns {boolean} True if there are states to undo
		 */
		canUndo() {
			return past.length > 0;
		},

		/**
		 * Check if redo is possible
		 * @returns {boolean} True if there are states to redo
		 */
		canRedo() {
			return future.length > 0;
		}
	};
}