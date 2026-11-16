// Installs build/nc_outliner-<version>.tar.gz into a Nextcloud running in Docker, then checks that
// Nextcloud uses the copy just installed. Usage (after `npm run package`):
//
//   npm run install:docker -- <container> [--root <path> | --root=<path>] [--same-version]
//
// It replaces custom_apps/nc_outliner as a whole folder (never copies over it), runs `occ upgrade`
// and `occ app:enable`, and stops with a clear message when:
// - Nextcloud has another nc_outliner folder it could load instead (for example under apps/);
// - the server already runs this version with different code. Browsers would keep the old cached
//   script, because Nextcloud's ?v= cache buster comes from the version. Raise it in
//   appinfo/info.xml and package.json, or pass --same-version for a server nobody browses yet.
//   (This is what broke the 2026-11-06 install: see CHANGELOG.md.)

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { existsSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseInstallArgs } from './install-args.mjs'

const APP_ID = 'nc_outliner'
const root = join(dirname(fileURLToPath(import.meta.url)), '..')

/**
 * @param {string} message what is wrong and how to fix it
 */
function fail(message) {
	console.error(`install: ${message}`)
	process.exit(1)
}

// Parse and check the arguments before any docker call.
let parsed
try {
	parsed = parseInstallArgs(process.argv.slice(2))
} catch (error) {
	fail(error.message)
}
const { container, ncRoot, sameVersionOk } = parsed

/**
 * Run a shell command in the container.
 *
 * @param {string} script sh script
 * @param {{user?: string, allowFail?: boolean}} [options] run as this user; return '' on failure
 * @return {string} trimmed output
 */
function inContainer(script, { user, allowFail = false } = {}) {
	const userArgs = user ? ['-u', user] : []
	try {
		return execFileSync('docker', ['exec', ...userArgs, container, 'sh', '-c', script], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim()
	} catch (error) {
		if (allowFail) {
			return ''
		}
		fail(`in ${container}: ${script}\n${error.stderr || error.message}`)
		return ''
	}
}

/**
 * @param {string} command occ arguments
 * @param {{allowFail?: boolean}} [options] return '' on failure
 * @return {string} output
 */
function occ(command, options = {}) {
	return inContainer(`cd ${ncRoot} && php occ ${command}`, { user: 'www-data', ...options })
}

// The container name goes to docker as its own argument (no shell).
const version = readFileSync(join(root, 'appinfo/info.xml'), 'utf8').match(/<version>([^<]+)<\/version>/)?.[1]
const tarball = join(root, 'build', `${APP_ID}-${version}.tar.gz`)
if (!existsSync(tarball)) {
	fail(`${tarball} is missing. Run \`npm run package\` first.`)
}
const localMain = createHash('sha256').update(readFileSync(join(root, 'js', `${APP_ID}-main.mjs`))).digest('hex')

// Every folder Nextcloud could load the app from. Only custom_apps/ may hold it.
const target = `${ncRoot}/custom_apps/${APP_ID}`
// No allowFail here: if find cannot read the tree, stop, rather than report "no other copies".
const copies = inContainer(`find ${ncRoot} -path '${ncRoot}/data' -prune -o -path '*/${APP_ID}/appinfo/info.xml' -print`)
	.split('\n').filter(Boolean).map((path) => path.replace(/\/appinfo\/info\.xml$/, ''))
const strays = copies.filter((path) => path !== target)
if (strays.length > 0) {
	fail(`Nextcloud has other ${APP_ID} folders it could load instead of ${target}:\n  ${strays.join('\n  ')}\nRemove them (keep a backup), then run this again.`)
}

// No allowFail: if occ cannot report the installed version, stop before the folder is replaced.
const installed = JSON.parse(occ('app:list --output=json'))
const installedVersion = installed.enabled?.[APP_ID] ?? installed.disabled?.[APP_ID] ?? null
if (installedVersion === version && !sameVersionOk) {
	// An unreadable script counts as different: refuse rather than overwrite a server we cannot see.
	const remoteMain = inContainer(`sha256sum ${target}/js/${APP_ID}-main.mjs | cut -d' ' -f1`, { allowFail: true })
	if (remoteMain !== localMain) {
		fail(`the server already runs ${APP_ID} ${version} with different code (or its script cannot be read). Browsers would keep the old cached files.\nRaise the version in appinfo/info.xml and package.json, run \`npm run package\`, then install again.`)
	}
}

console.log(`Installing ${APP_ID} ${version} into ${container}:${target} (was ${installedVersion ?? 'not installed'})`)
execFileSync('docker', ['cp', tarball, `${container}:/tmp/${APP_ID}.tar.gz`], { stdio: 'inherit' })
inContainer(`set -e; rm -rf ${target}; mkdir -p ${ncRoot}/custom_apps; tar -xzf /tmp/${APP_ID}.tar.gz -C ${ncRoot}/custom_apps; rm /tmp/${APP_ID}.tar.gz; chown -R www-data:www-data ${target}`)

// A version change puts Nextcloud into "update needed" until the upgrade runs.
if (installedVersion && installedVersion !== version) {
	console.log(occ('upgrade --no-interaction'))
}
console.log(occ(`app:enable ${APP_ID}`))

const appPath = occ(`app:getpath ${APP_ID}`)
const remoteMain = inContainer(`sha256sum ${appPath}/js/${APP_ID}-main.mjs | cut -d' ' -f1`)
const nowVersion = JSON.parse(occ('app:list --output=json')).enabled?.[APP_ID]
if (appPath !== target || remoteMain !== localMain || nowVersion !== version) {
	fail(`check failed: Nextcloud loads ${appPath} (want ${target}), version ${nowVersion} (want ${version}), script ${remoteMain === localMain ? 'matches' : 'differs'}.`)
}
console.log(`Done: Nextcloud runs ${APP_ID} ${version} from ${appPath}, and its script matches this build.`)
