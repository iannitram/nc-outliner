// Command-line rules for tools/install-docker.mjs. Kept in their own file so the rules can be tested
// without Docker. Accepted: <container> [--root <path> | --root=<path>] [--same-version].
// Anything else throws before the script makes any docker call.

const DEFAULT_ROOT = '/var/www/html'
const CONTAINER = /^[A-Za-z0-9][A-Za-z0-9_.-]*$/
// The root path is written into shell commands in the container, so only plain absolute paths pass.
const ROOT = /^\/[A-Za-z0-9._/-]*[A-Za-z0-9._-]$/
const USAGE = 'usage: npm run install:docker -- <container> [--root <path>] [--same-version]'

/**
 * @param {string[]} argv arguments after the script name
 * @return {{container: string, ncRoot: string, sameVersionOk: boolean}} parsed options
 * @throws {Error} what is wrong and how to fix it
 */
export function parseInstallArgs(argv) {
	const positional = []
	let rootValue = null
	let sameVersionOk = false
	for (let i = 0; i < argv.length; i++) {
		const arg = argv[i]
		if (arg === '--same-version') {
			sameVersionOk = true
		} else if (arg === '--root' || arg.startsWith('--root=')) {
			if (rootValue !== null) {
				throw new Error(`--root was given twice.\n${USAGE}`)
			}
			if (arg === '--root') {
				const next = argv[i + 1]
				if (next === undefined || next.startsWith('--')) {
					throw new Error(`--root needs a path, such as --root /var/www/html.\n${USAGE}`)
				}
				rootValue = next
				i++
			} else {
				rootValue = arg.slice('--root='.length)
			}
		} else if (arg.startsWith('--')) {
			throw new Error(`unknown option ${arg}.\n${USAGE}`)
		} else {
			positional.push(arg)
		}
	}

	if (positional.length > 1) {
		throw new Error(`unexpected extra argument "${positional[1]}".\n${USAGE}`)
	}
	const container = positional[0]
	if (!container || !CONTAINER.test(container)) {
		throw new Error(`name the container: npm run install:docker -- <container>   (docker ps lists them)\n${USAGE}`)
	}

	const ncRoot = rootValue ?? DEFAULT_ROOT
	if (!ROOT.test(ncRoot)) {
		throw new Error(`--root needs an absolute path inside the container, such as /var/www/html (got "${ncRoot}").`)
	}
	if (ncRoot.split('/').includes('..')) {
		throw new Error(`--root must not contain ".." (got "${ncRoot}"). Give the real path.`)
	}
	return { container, ncRoot, sameVersionOk }
}
