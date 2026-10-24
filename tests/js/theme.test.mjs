import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  THEME_PREFS,
  normalizePref,
  nextPref,
  themeAttr,
  storageKey,
  loadPref,
  savePref
} from '../../js/theme.js';

test('THEME_PREFS equals [\'auto\', \'light\', \'dark\']', () => {
  assert.deepStrictEqual(THEME_PREFS, ['auto', 'light', 'dark']);
});

test('normalizePref returns the value when it is one of THEME_PREFS', () => {
  assert.strictEqual(normalizePref('dark'), 'dark');
  assert.strictEqual(normalizePref('light'), 'light');
  assert.strictEqual(normalizePref('auto'), 'auto');
});

test('normalizePref returns \'auto\' for invalid values', () => {
  assert.strictEqual(normalizePref('bogus'), 'auto');
  assert.strictEqual(normalizePref(undefined), 'auto');
  assert.strictEqual(normalizePref(null), 'auto');
});

test('nextPref returns the next theme preference with wrapping', () => {
  assert.strictEqual(nextPref('auto'), 'light');
  assert.strictEqual(nextPref('light'), 'dark');
  assert.strictEqual(nextPref('dark'), 'auto');
  assert.strictEqual(nextPref('bogus'), 'light');
});

test('themeAttr returns null for \'auto\' or invalid values, otherwise the value', () => {
  assert.strictEqual(themeAttr('auto'), null);
  assert.strictEqual(themeAttr('light'), 'light');
  assert.strictEqual(themeAttr('dark'), 'dark');
  assert.strictEqual(themeAttr('bogus'), null);
});

test('storageKey generates correct keys', () => {
  assert.strictEqual(storageKey('alice'), 'outliner.theme.alice');
  assert.strictEqual(storageKey(''), 'outliner.theme.anonymous');
  assert.strictEqual(storageKey(null), 'outliner.theme.anonymous');
});

test('loadPref loads preferences correctly', () => {
  const storage = {
    getItem: (k) => k === 'outliner.theme.alice' ? 'dark' : null
  };
  assert.strictEqual(loadPref(storage, 'alice'), 'dark');
  
  // Test with bogus value
  const storage2 = {
    getItem: (k) => k === 'outliner.theme.alice' ? 'bogus' : null
  };
  assert.strictEqual(loadPref(storage2, 'alice'), 'auto');
  
  // Test with null storage
  assert.strictEqual(loadPref(null, 'alice'), 'auto');
});

test('loadPref handles exceptions', () => {
  const storage = {
    getItem() { throw new Error('blocked'); }
  };
  assert.strictEqual(loadPref(storage, 'alice'), 'auto');
});

test('savePref saves preferences correctly and returns boolean', () => {
  const calls = [];
  const storage = {
    setItem(k, v) { calls.push([k, v]); }
  };
  
  // Test successful save
  assert.strictEqual(savePref(storage, 'alice', 'dark'), true);
  assert.deepStrictEqual(calls, [['outliner.theme.alice', 'dark']]);
  
  // Test with bogus value (should normalize)
  calls.length = 0;
  assert.strictEqual(savePref(storage, 'alice', 'bogus'), true);
  assert.deepStrictEqual(calls, [['outliner.theme.alice', 'auto']]);
  
  // Test with exception
  const storage2 = {
    setItem() { throw new Error('full'); }
  };
  assert.strictEqual(savePref(storage2, 'alice', 'dark'), false);
  
  // Test with null storage
  assert.strictEqual(savePref(null, 'alice', 'dark'), false);
});