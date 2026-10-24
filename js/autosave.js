export function createAutosave({ save, onStatus = () => {}, delayMs = 1500, retryMs = 5000, timers = globalThis }) {
	let status = 'saved';
	let dirty = false;
	let inFlight = false;
	let timer = null;

	function setStatus(newStatus) {
		if (status !== newStatus) {
			status = newStatus;
			onStatus(status);
		}
	}

	function clearTimer() {
		if (timer !== null) {
			timers.clearTimeout(timer);
			timer = null;
		}
	}

	async function saveHandler() {
		// If already in flight or not dirty, do nothing
		if (inFlight || !dirty) return;

		dirty = false;  // Mark that we're about to start saving
		inFlight = true; // Mark that a save is in progress

		try {
			const result = await save();
			
			// Reset in-flight status now that we've finished the save attempt
			inFlight = false;
			
			if (result && result.conflict) {
				setStatus('conflict');
				dirty = true; // Keep dirty so that if change() is called again, it will trigger another timer
			} else {
				// After completing a successful save, check if we became dirty 
				// while processing the save (or right after it started)
				if (dirty) {
					armTimer(delayMs);
				} else {
					setStatus('saved');
				}
			}
		} catch (error) {
			inFlight = false; // Save failed
			dirty = true;     // Mark that we should try again
			setStatus('error'); 
			armTimer(retryMs);
		}
	}

	function armTimer(ms) {
		clearTimer();
		timer = timers.setTimeout(() => {
			timer = null;
			if (dirty && !inFlight) {
				saveHandler();
			}
		}, ms);
	}

	return {
		change() {
			if (status === 'conflict') return;

			dirty = true;
			
			if (status === 'saved') {
				setStatus('saving');
			}
			
			armTimer(delayMs);
		},

		async flush() {
			if (status === 'conflict' || (!dirty && !inFlight)) {
				return Promise.resolve();
			}

			if (inFlight) {
				// Wait for current save to complete
				while (inFlight) {
					await new Promise(resolve => setTimeout(resolve, 10));
				}
				return Promise.resolve();
			}

			if (dirty) {
				clearTimer();
				return saveHandler();
			}
		},

		resume() {
			clearTimer();
			dirty = false;
			setStatus('saved');
		},

		status() {
			return status;
		}
	};
}

export function statusLabel(s) {
	switch (s) {
		case 'saved': return 'Saved';
		case 'saving': return 'Saving...';
		case 'error': return "Can't save (retrying)";
		case 'conflict': return 'Changed elsewhere';
		default: return s;
	}
}