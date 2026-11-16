/**
 * Strip a trailing .opml extension (case-insensitive) for outline display name.
 *
 * @param {string|null|undefined} name outline filename or name
 * @return {string} display name without .opml extension
 */
export function formatOutlineName(name) {
	if (!name) {
		return 'Untitled'
	}
	const stripped = name.replace(/\.opml$/i, '')
	return stripped || 'Untitled'
}

/**
 * Format a modified time as a relative string according to mockup C:
 * - "Edited just now" under a minute;
 * - "Edited N min ago" under an hour;
 * - "Edited N h ago" today;
 * - "Yesterday";
 * - day and month ("12 Oct") within the year;
 * - "12 Oct 2025" before that.
 *
 * Uses the browser's locale through Intl for the month names.
 *
 * @param {number|Date} mtime Unix timestamp in seconds or Date
 * @param {Date|number} [now] reference time
 * @param {string|string[]} [locale] locale identifier for Intl formatting
 * @return {string} formatted relative time
 */
export function formatRelativeTime(mtime, now = new Date(), locale = undefined) {
	if (!mtime) {
		return ''
	}
	const date = mtime instanceof Date
		? mtime
		: new Date(typeof mtime === 'number' && mtime < 1e11 ? mtime * 1000 : mtime)
	if (Number.isNaN(date.getTime())) {
		return ''
	}

	const nowDate = now instanceof Date ? now : new Date(now)
	const diffMs = nowDate.getTime() - date.getTime()
	const diffSec = Math.floor(diffMs / 1000)

	if (diffSec < 60) {
		return 'Edited just now'
	}
	if (diffSec < 3600) {
		const min = Math.floor(diffSec / 60)
		return `Edited ${min} min ago`
	}

	const isToday = date.getFullYear() === nowDate.getFullYear()
		&& date.getMonth() === nowDate.getMonth()
		&& date.getDate() === nowDate.getDate()
	if (isToday) {
		const hours = Math.max(1, Math.floor(diffSec / 3600))
		return `Edited ${hours} h ago`
	}

	const yesterday = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate() - 1)
	const isYesterday = date.getFullYear() === yesterday.getFullYear()
		&& date.getMonth() === yesterday.getMonth()
		&& date.getDate() === yesterday.getDate()
	if (isYesterday) {
		return 'Yesterday'
	}

	const month = new Intl.DateTimeFormat(locale, { month: 'short' }).format(date)
	if (date.getFullYear() === nowDate.getFullYear()) {
		return `${date.getDate()} ${month}`
	}
	return `${date.getDate()} ${month} ${date.getFullYear()}`
}
