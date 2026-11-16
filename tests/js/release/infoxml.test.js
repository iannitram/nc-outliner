import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { describe, expect, it } from 'vitest'

// Release guard for the merged app-store feed (craft-nc-appstore): the feed reads id, version and the
// Nextcloud and PHP bounds from this file, and the build workflow checks the version against the tag.
const xml = readFileSync(resolve(process.cwd(), 'appinfo/info.xml'), 'utf8')

function tag(name) {
	const m = xml.match(new RegExp('<' + name + '>\\s*([^<]*?)\\s*</' + name + '>'))
	return m ? m[1] : null
}
function attrs(name) {
	const m = xml.match(new RegExp('<' + name + '\\b([^>]*)/?>'))
	if (!m) {
		return null
	}
	const out = {}
	for (const a of m[1].matchAll(/([\w-]+)="([^"]*)"/g)) {
		out[a[1]] = a[2]
	}
	return out
}
const num = (v) => v.split('.').map(Number)
function le(a, b) {
	const x = num(a)
	const y = num(b)
	for (let i = 0; i < Math.max(x.length, y.length); i++) {
		const d = (x[i] || 0) - (y[i] || 0)
		if (d) {
			return d < 0
		}
	}
	return true
}

describe('appinfo/info.xml release fields', () => {
	it('has the app id', () => {
		expect(tag('id')).toBe('nc_outliner')
	})
	it('has a plain a.b.c version (no prefix; a -suffix only for pre-releases)', () => {
		expect(tag('version')).toMatch(/^\d+\.\d+\.\d+(-[0-9A-Za-z.]+)?$/)
	})
	it('declares a Nextcloud range that covers 33', () => {
		const nc = attrs('nextcloud')
		expect(nc).not.toBeNull()
		expect(nc['min-version']).toMatch(/^\d+(\.\d+){0,2}$/)
		expect(nc['max-version']).toMatch(/^\d+(\.\d+){0,2}$/)
		expect(le(nc['min-version'], '33')).toBe(true)
		expect(le('33', nc['max-version'])).toBe(true)
	})
	it('declares a PHP minimum of at least 8.2 (Nextcloud 33)', () => {
		const php = attrs('php')
		expect(php).not.toBeNull()
		expect(php['min-version']).toMatch(/^\d+\.\d+(\.\d+)?$/)
		expect(le('8.2', php['min-version'])).toBe(true)
	})
})
