// Runs PHP lint or phpunit. Uses a local PHP 8.4+ when PHP_BIN (or php) reports one;
// otherwise a throwaway container from the existing nextcloud:33.0.10-apache image,
// with the checkout mounted and networking off. Nothing is pulled here.
//
// Usage: node tests/tools/php.mjs lint | test
import { spawnSync } from 'node:child_process'
import { existsSync, readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
const IMAGE = 'nextcloud:33.0.10-apache'
const mode = process.argv[2]

function phpFiles(dir) {
	const out = []
	for (const name of readdirSync(dir)) {
		const path = join(dir, name)
		if (statSync(path).isDirectory()) {
			out.push(...phpFiles(path))
		} else if (name.endsWith('.php')) {
			out.push(path)
		}
	}
	return out
}

function localPhp() {
	const bin = process.env.PHP_BIN || 'php'
	const probe = spawnSync(bin, ['-r', 'echo PHP_VERSION_ID;'], { encoding: 'utf8' })
	if (probe.status !== 0) {
		return null
	}
	return Number(probe.stdout) >= 80400 ? bin : null
}

function run(args) {
	const result = spawnSync(args[0], args.slice(1), { stdio: 'inherit', cwd: root })
	return result.status ?? 1
}

// Argument list that runs `php <phpArgs>` in the chosen environment.
function phpCommand(phpArgs) {
	const bin = localPhp()
	if (bin) {
		return [bin, ...phpArgs]
	}
	return [
		'docker',
		'run',
		'--rm',
		'--network',
		'none',
		'-v',
		`${root}:/app:ro`,
		'-w',
		'/app',
		IMAGE,
		'php',
		...phpArgs,
	]
}

if (mode === 'lint') {
	const files = ['appinfo', 'lib', 'templates', 'tests']
		.filter((dir) => existsSync(join(root, dir)))
		.flatMap((dir) => phpFiles(join(root, dir)))
	let status = 0
	for (const file of files) {
		const rel = relative(root, file).split('\\').join('/')
		const code = run(phpCommand(['-l', rel]))
		if (code !== 0) {
			status = code
		}
	}
	process.exit(status)
} else if (mode === 'test') {
	if (!existsSync(join(root, 'vendor', 'autoload.php'))) {
		console.error('vendor/ is missing: run `composer install` first (see docs/development.md).')
		process.exit(1)
	}
	// The checkout is mounted read-only in the container, so phpunit must not write its result cache.
	process.exit(run(phpCommand(['vendor/bin/phpunit', '--do-not-cache-result', '--bootstrap', 'vendor/autoload.php', 'tests/php'])))
} else {
	console.error('usage: node tests/tools/php.mjs lint | test')
	process.exit(2)
}
