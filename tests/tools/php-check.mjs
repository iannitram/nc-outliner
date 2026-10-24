// Portable entry point: native PHP 8.4+, otherwise the project's Nextcloud image.
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const mode = process.argv[2] ?? 'all';
if (!['test', 'lint', 'all'].includes(mode)) {
  console.error('Usage: node tests/tools/php-check.mjs [test|lint|all]');
  process.exit(2);
}
const root = fileURLToPath(new URL('../../', import.meta.url));
const php = process.env.PHP_BIN || 'php';
const probe = spawnSync(php, ['-r', 'echo PHP_VERSION_ID;'], { encoding: 'utf8' });
let result;
if (probe.status === 0 && Number(probe.stdout) >= 80400) {
  result = spawnSync(php, ['tests/tools/php-check.php', mode], { cwd: root, stdio: 'inherit' });
} else if (process.env.PHP_BIN) {
  console.error(`PHP_BIN must point to PHP 8.4 or newer: ${probe.error?.message || probe.stderr || probe.stdout}`);
  process.exit(1);
} else {
  console.log('Using nextcloud:33.0.10-apache for PHP 8.4 checks.');
  result = spawnSync('docker', [
    'run', '--rm', '--pull=never', '--network=none',
    '--mount', `type=bind,src=${root},dst=/w,readonly`, '-w', '/w',
    '--entrypoint', 'php', 'nextcloud:33.0.10-apache',
    'tests/tools/php-check.php', mode,
  ], { cwd: root, stdio: 'inherit', env: { ...process.env, MSYS_NO_PATHCONV: '1' } });
}
if (result.error) console.error(result.error.message);
if (result.status !== 0) {
  console.error('PHP checks failed. Install PHP 8.4+, set PHP_BIN, or pull nextcloud:33.0.10-apache with Docker running.');
}
process.exit(result.status ?? 1);
