import { describe, expect, it } from 'vitest'
import { formatOutlineName, formatRelativeTime } from '../../../src/utils/format.js'

describe('formatOutlineName', () => {
	it('strips trailing .opml extension case-insensitively', () => {
		expect(formatOutlineName('Community garden plan.opml')).toBe('Community garden plan')
		expect(formatOutlineName('Trip plan.OPML')).toBe('Trip plan')
		expect(formatOutlineName('Reading list.Opml')).toBe('Reading list')
	})

	it('preserves names that do not end in .opml', () => {
		expect(formatOutlineName('Community garden plan')).toBe('Community garden plan')
		expect(formatOutlineName('Notes.txt')).toBe('Notes.txt')
	})

	it('returns Untitled when given empty, null, undefined or only extension', () => {
		expect(formatOutlineName('')).toBe('Untitled')
		expect(formatOutlineName(null)).toBe('Untitled')
		expect(formatOutlineName(undefined)).toBe('Untitled')
		expect(formatOutlineName('.opml')).toBe('Untitled')
		expect(formatOutlineName('.OPML')).toBe('Untitled')
	})

	it('preserves .opml if it appears within the name but not at the end', () => {
		expect(formatOutlineName('my.opml.file.opml')).toBe('my.opml.file')
		expect(formatOutlineName('opml-collection')).toBe('opml-collection')
	})
})

describe('formatRelativeTime', () => {
	const fixedNow = new Date(2026, 9, 28, 14, 0, 0) // 28 Oct 2026 14:00:00

	it('returns Edited just now when under a minute ago or slight clock skew in future', () => {
		const justNow = new Date(2026, 9, 28, 13, 59, 45) // 15s ago
		const zeroDiff = new Date(2026, 9, 28, 14, 0, 0) // 0s ago
		const futureSkew = new Date(2026, 9, 28, 14, 0, 10) // 10s in future
		const fiftyNineSec = new Date(2026, 9, 28, 13, 59, 1) // 59s ago

		expect(formatRelativeTime(justNow, fixedNow)).toBe('Edited just now')
		expect(formatRelativeTime(zeroDiff, fixedNow)).toBe('Edited just now')
		expect(formatRelativeTime(futureSkew, fixedNow)).toBe('Edited just now')
		expect(formatRelativeTime(fiftyNineSec, fixedNow)).toBe('Edited just now')
	})

	it('returns Edited N min ago when under an hour ago', () => {
		const oneMin = new Date(2026, 9, 28, 13, 59, 0) // 60s ago
		const fiveMin = new Date(2026, 9, 28, 13, 55, 0) // 5 min ago
		const fiftyNineMin = new Date(2026, 9, 28, 13, 1, 0) // 59 min ago

		expect(formatRelativeTime(oneMin, fixedNow)).toBe('Edited 1 min ago')
		expect(formatRelativeTime(fiveMin, fixedNow)).toBe('Edited 5 min ago')
		expect(formatRelativeTime(fiftyNineMin, fixedNow)).toBe('Edited 59 min ago')
	})

	it('returns Edited N h ago when earlier today (at least 1 hour ago)', () => {
		const oneHour = new Date(2026, 9, 28, 13, 0, 0) // 1 hour ago
		const twoHours = new Date(2026, 9, 28, 12, 0, 0) // 2 hours ago
		const sixHours = new Date(2026, 9, 28, 8, 0, 0) // 6 hours ago

		expect(formatRelativeTime(oneHour, fixedNow)).toBe('Edited 1 h ago')
		expect(formatRelativeTime(twoHours, fixedNow)).toBe('Edited 2 h ago')
		expect(formatRelativeTime(sixHours, fixedNow)).toBe('Edited 6 h ago')
	})

	it('returns Yesterday when on the previous calendar day', () => {
		const yesterdayAfternoon = new Date(2026, 9, 27, 16, 0, 0)
		const yesterdayMorning = new Date(2026, 9, 27, 9, 0, 0)

		expect(formatRelativeTime(yesterdayAfternoon, fixedNow)).toBe('Yesterday')
		expect(formatRelativeTime(yesterdayMorning, fixedNow)).toBe('Yesterday')
	})

	it('handles Yesterday across month and year boundaries', () => {
		const marchFirst = new Date(2026, 2, 1, 10, 0, 0)
		const febLast = new Date(2026, 1, 28, 20, 0, 0)
		expect(formatRelativeTime(febLast, marchFirst)).toBe('Yesterday')

		const newYearDay = new Date(2026, 0, 1, 11, 0, 0)
		const newYearEve = new Date(2025, 11, 31, 22, 0, 0)
		expect(formatRelativeTime(newYearEve, newYearDay)).toBe('Yesterday')
	})

	it('returns day and month ("12 Oct") within the current year', () => {
		const oct12 = new Date(2026, 9, 12, 10, 0, 0)
		const oct3 = new Date(2026, 9, 3, 10, 0, 0)
		const jan15 = new Date(2026, 0, 15, 10, 0, 0)

		expect(formatRelativeTime(oct12, fixedNow, 'en-US')).toBe('12 Oct')
		expect(formatRelativeTime(oct3, fixedNow, 'en-US')).toBe('3 Oct')
		expect(formatRelativeTime(jan15, fixedNow, 'en-US')).toBe('15 Jan')
	})

	it('returns day, month, and year ("12 Oct 2025") before the current year', () => {
		const oct12LastYear = new Date(2025, 9, 12, 10, 0, 0)
		const jul4TwoYearsAgo = new Date(2024, 6, 4, 10, 0, 0)

		expect(formatRelativeTime(oct12LastYear, fixedNow, 'en-US')).toBe('12 Oct 2025')
		expect(formatRelativeTime(jul4TwoYearsAgo, fixedNow, 'en-US')).toBe('4 Jul 2024')
	})

	it('accepts Unix timestamps in seconds', () => {
		const oct12Seconds = Math.floor(new Date(2026, 9, 12, 10, 0, 0).getTime() / 1000)
		expect(formatRelativeTime(oct12Seconds, fixedNow, 'en-US')).toBe('12 Oct')
	})

	it('returns empty string for missing or invalid timestamps', () => {
		expect(formatRelativeTime(null)).toBe('')
		expect(formatRelativeTime(undefined)).toBe('')
		expect(formatRelativeTime(0)).toBe('')
		expect(formatRelativeTime('not-a-date')).toBe('')
	})

	it('uses Intl for month names respecting locale without hard-coded lists', () => {
		const oct12 = new Date(2026, 9, 12, 10, 0, 0)
		const germanMonth = new Intl.DateTimeFormat('de-DE', { month: 'short' }).format(oct12)
		const frenchMonth = new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(oct12)

		expect(formatRelativeTime(oct12, fixedNow, 'de-DE')).toBe(`12 ${germanMonth}`)
		expect(formatRelativeTime(oct12, fixedNow, 'fr-FR')).toBe(`12 ${frenchMonth}`)
	})
})
