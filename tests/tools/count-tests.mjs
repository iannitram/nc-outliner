// Run: node tests/tools/count-tests.mjs <file> <min> [regex]
// Exits 1 unless <file> holds at least <min> lines matching the regex
// (default: a line that starts a node:test case, test( or it( ).
import { readFileSync } from 'node:fs';

const [file, minArg, pattern] = process.argv.slice(2);
const min = Number(minArg);
if (!file || !Number.isInteger(min) || min < 1) {
  console.error('run: node tests/tools/count-tests.mjs <file> <min> [regex]');
  process.exit(2);
}
const re = new RegExp(pattern ?? String.raw`^\s*(test|it)\(`, 'gm');
let text;
try {
  text = readFileSync(file, 'utf8');
} catch (e) {
  console.error(`cannot read ${file}: ${e.message}`);
  process.exit(1);
}
const n = (text.match(re) ?? []).length;
console.log(`${file}: ${n} tests (need ${min})`);
process.exit(n >= min ? 0 : 1);
