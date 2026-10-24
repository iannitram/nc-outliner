import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';

const root = join(dirname(fileURLToPath(import.meta.url)), '..', '..');

test('package metadata is configured for the test runner', () => {
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.equal(pkg.type, 'module');
  assert.equal(pkg.scripts.test, 'node --test "tests/js/*.test.mjs"');
});

test('app info declares the app and page route', () => {
  const info = readFileSync(join(root, 'appinfo', 'info.xml'), 'utf8');
  assert.match(info, /<id>outliner<\/id>/);
  assert.match(info, /<route>outliner\.page\.index<\/route>/);
});

test('stylesheet defines the outliner colour variables', () => {
  const css = readFileSync(join(root, 'css', 'outliner.css'), 'utf8');
  for (const variable of ['--ol-bg:', '--ol-fg:', '--ol-muted:', '--ol-border:', '--ol-accent:', '--ol-accent-fg:', '--ol-hover:']) {
    assert.ok(css.includes(variable), `missing ${variable}`);
  }
});

test('count-tests enforces the requested minimum', () => {
  const dir = mkdtempSync(join(tmpdir(), 'nc-outliner-'));
  const file = join(dir, 'sample.mjs');
  writeFileSync(file, "test('a', () => {});\ntest('b', () => {});\n");
  const script = join(root, 'tests', 'tools', 'count-tests.mjs');
  assert.equal(spawnSync(process.execPath, [script, file, '2']).status, 0);
  assert.equal(spawnSync(process.execPath, [script, file, '3']).status, 1);
});
