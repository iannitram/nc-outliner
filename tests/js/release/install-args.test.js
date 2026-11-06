import { describe, expect, it } from 'vitest'
import { parseInstallArgs } from '../../../tools/install-args.mjs'

// Release guard for tools/install-docker.mjs: the argument rules must refuse bad input before docker runs.
describe('install-docker arguments', () => {
	it('accepts --root <path> and --root=<path> alike', () => {
		expect(parseInstallArgs(['nc', '--root', '/srv/nc']).ncRoot).toBe('/srv/nc')
		expect(parseInstallArgs(['nc', '--root=/srv/nc']).ncRoot).toBe('/srv/nc')
		expect(parseInstallArgs(['--root=/srv/nc', 'nc']).container).toBe('nc')
	})

	it('defaults the root and reads --same-version', () => {
		expect(parseInstallArgs(['nc'])).toEqual({ container: 'nc', ncRoot: '/var/www/html', sameVersionOk: false })
		expect(parseInstallArgs(['nc', '--same-version']).sameVersionOk).toBe(true)
	})

	it.each([
		['--root=/x/..', ['nc', '--root=/x/..']],
		['--root /x/..', ['nc', '--root', '/x/..']],
		['--root=', ['nc', '--root=']],
		['--root without a value', ['nc', '--root']],
		['an unknown option', ['nc', '--bogus']],
		['an extra positional argument', ['nc', 'extra']],
		['a missing container', ['--same-version']],
		['a relative root', ['nc', '--root=srv/nc']],
		['a root given twice', ['nc', '--root=/a', '--root=/b']],
	])('refuses %s', (_, argv) => {
		expect(() => parseInstallArgs(argv)).toThrow()
	})
})
