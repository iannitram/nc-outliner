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

	function armTimer(ms) {
		clearTimer();
		timer = timers.setTimeout(() => {
			timer = null;
			if (!inFlight && dirty) {
				dirty = false;
				inFlight = true;
				save().then(result => {
					inFlight = false;
					if (result?.conflict === true) {
						dirty = true;
						setStatus('conflict');
					} else if (dirty) {
						// If dirty became true during the save, re-arm the timer
						armTimer(delayMs);
					} else {
						setStatus('saved');
					}
				}).catch(() => {
					inFlight = false;
					dirty = true;
					setStatus('error');
					armTimer(retryMs);
				});
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

			// Clear any pending timer before proceeding
			clearTimer();

			// If a save is already in flight, wait for it to complete
			if (inFlight) {
				return new Promise((resolve) => {
					const checkComplete = () => {
						if (!inFlight) {
							resolve();
						} else {
							setTimeout(checkComplete, 1);
						}
					};
					checkComplete();
				});
			}

			// If we have something to save...
			dirty = false;
			inFlight = true;
			
			try {
				const result = await save();
				inFlight = false;
				
				if (result?.conflict === true) {
					dirty = true;
					setStatus('conflict');
				} else if (dirty) {
					// If dirty became true during the save, re-arm the timer
					armTimer(delayMs);
				} else {
					setStatus('saved');
				}
			} catch (error) {
				inFlight = false;
				dirty = true;
				setStatus('error');
				armTimer(retryMs);
			}
			
			return Promise.resolve();
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