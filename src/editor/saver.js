/**
 * Debounced, serialized autosaving for an outline document.
 *
 * @param {object} options saver configuration
 * @param {(document: object) => Promise<object>} options.save save the latest outline
 * @param {number} [options.delay=1500] debounce delay in milliseconds
 * @param {number[]} [options.retryDelays] retry delays in milliseconds
 * @param {(status: string) => void} [options.onStatus] status listener
 * @param {(result: object) => void} [options.onConflict] conflict listener
 */
export function createSaver(options) {
	const { save, delay = 1500, retryDelays = [2000, 5000, 15000], onStatus = () => {}, onConflict = () => {} } = options
	let timer = null
	let retryTimer = null
	let pending = null
	let dirty = false
	let stopped = false
	let currentStatus = 'saved'
	let retryIndex = 0
	let pumpPromise = null

	/**
	 *
 	 * @param {string} value next visible status
	 */
	function setStatus(value) {
		currentStatus = value
		onStatus(value)
	}

	/**
	 *
	 */
	function scheduleRetry() {
		if (stopped || retryTimer !== null) {
			return
		}
		const wait = retryDelays[Math.min(retryIndex, retryDelays.length - 1)] ?? 15000
		retryIndex++
		retryTimer = setTimeout(() => {
			retryTimer = null
			void flush()
		}, wait)
	}

	/**
	 *
	 */
	async function pump() {
		while (!stopped && pending !== null) {
			const document = pending
			pending = null
			try {
				const result = await save(document)
				if (result?.conflict) {
					pending ??= document
					dirty = true
					setStatus('conflict')
					onConflict(result)
					return
				}
				retryIndex = 0
			} catch {
				pending ??= document
				dirty = true
				setStatus('error')
				scheduleRetry()
				return
			}
		}
		if (!stopped && pending === null) {
			dirty = false
			setStatus('saved')
		}
	}

	/**
	 *
	 */
	function flush() {
		clearTimeout(timer)
		timer = null
		if (stopped || currentStatus === 'conflict') {
			return pumpPromise ?? Promise.resolve()
		}
		clearTimeout(retryTimer)
		retryTimer = null
		if (pumpPromise) {
			return pumpPromise
		}
		if (pending === null) {
			return Promise.resolve()
		}
		setStatus('saving')
		pumpPromise = pump().finally(() => {
			pumpPromise = null
			// schedule() may run between pump's last save and this finally callback.
			if (!stopped && pending !== null && !['error', 'conflict'].includes(currentStatus)) {
				void flush()
			}
		})
		return pumpPromise
	}

	return {
		schedule(document) {
			if (stopped || currentStatus === 'conflict') {
				return
			}
			pending = document
			dirty = true
			setStatus('saving')
			clearTimeout(retryTimer)
			retryTimer = null
			clearTimeout(timer)
			timer = setTimeout(() => {
				void flush()
			}, delay)
		},
		flush,
		status: () => currentStatus,
		isDirty: () => dirty,
		destroy() {
			stopped = true
			clearTimeout(timer)
			clearTimeout(retryTimer)
		},
	}
}
