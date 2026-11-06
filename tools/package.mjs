// Builds the installable app: build/nc_outliner-<version>.tar.gz, holding one nc_outliner/ folder.
// Run it with `npm run package` (that builds first). See INSTALL.md.
//
// It refuses to package when something would make the install misbehave:
// - appinfo/info.xml and package.json disagree on the version;
// - the working tree has uncommitted changes (the build records the commit it came from);
// - the build is missing, or is from another commit than HEAD.
// Pass --allow-dirty to package uncommitted work for a throwaway test server.

import { execFileSync } from 'node:child_process'
import { createHash } from 'node:crypto'
import { cpSync, existsSync, mkdirSync, readdirSync, readFileSync, rmSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const allowDirty = process.argv.includes('--allow-dirty')
const APP_ID = 'nc_outliner'

/**
 * Stop with a message.
 *
 * @param {string} message what is wrong and how to fix it
 */
function fail(message) {
	console.error(`package: ${message}`)
	process.exit(1)
}

/**
 * @param {string[]} args git arguments
 * @return {string} trimmed output
 */
function git(args) {
	return execFileSync('git', args, { cwd: root, encoding: 'utf8' }).trim()
}

const infoXml = readFileSync(join(root, 'appinfo/info.xml'), 'utf8')
const version = infoXml.match(/<version>([^<]+)<\/version>/)?.[1]
const packageVersion = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8')).version
if (!version) {
	fail('appinfo/info.xml has no <version>.')
}
if (version !== packageVersion) {
	fail(`appinfo/info.xml says ${version} but package.json says ${packageVersion}. Make them match.`)
}

// Untracked files count too: the package copies whole folders (lib/, templates/), so a new file would ship.
const dirty = git(['status', '--porcelain', '--untracked-files=normal'])
if (dirty && !allowDirty) {
	fail(`uncommitted changes:\n${dirty}\nCommit them first, or pass --allow-dirty for a throwaway test server.`)
}

const head = git(['rev-parse', 'HEAD'])
const main = join(root, 'js', `${APP_ID}-main.mjs`)
if (!existsSync(main)) {
	fail('js/nc_outliner-main.mjs is missing. Run `npm run package`, which builds first.')
}
const built = JSON.parse(readFileSync(join(root, 'appinfo/build.json'), 'utf8')).commit
if (built !== head) {
	fail(`the build is from ${built}, not HEAD ${head}. Run \`npm run package\`, which builds first.`)
}

// Only what Nextcloud runs. No source maps, tests, node_modules or vendor/ (the app needs no
// Composer packages at run time; Nextcloud autoloads lib/ by the OCA\NcOutliner namespace).
const stage = join(root, 'build', 'stage')
const appDir = join(stage, APP_ID)
rmSync(stage, { recursive: true, force: true })
mkdirSync(appDir, { recursive: true })
for (const dir of ['appinfo', 'img', 'lib', 'templates']) {
	cpSync(join(root, dir), join(appDir, dir), { recursive: true })
}
mkdirSync(join(appDir, 'js'))
for (const name of readdirSync(join(root, 'js'))) {
	if (name.endsWith('.mjs') || name.endsWith('.js')) {
		cpSync(join(root, 'js', name), join(appDir, 'js', name))
	}
}
for (const file of ['README.md', 'CHANGELOG.md', 'INSTALL.md']) {
	if (existsSync(join(root, file))) {
		cpSync(join(root, file), join(appDir, file))
	}
}

const tarball = join(root, 'build', `${APP_ID}-${version}.tar.gz`)
rmSync(tarball, { force: true })
// Relative names and forward slashes, so GNU tar, bsdtar and Windows tar.exe all agree.
execFileSync('tar', ['-czf', `${APP_ID}-${version}.tar.gz`, '-C', 'stage', APP_ID], { cwd: join(root, 'build'), stdio: 'inherit' })
rmSync(stage, { recursive: true, force: true })

const mainHash = createHash('sha256').update(readFileSync(main)).digest('hex')
console.log(`Packaged ${APP_ID} ${version} (commit ${head.slice(0, 7)}${dirty ? ', with uncommitted changes' : ''})`)
console.log(`  ${tarball}`)
console.log(`  js/${APP_ID}-main.mjs sha256 ${mainHash}`)
console.log('Install it with INSTALL.md (Docker: npm run install:docker -- <container>).')
