import { describe, expect, it } from 'vitest'
import { parseVersionTree } from '../../../src/model/versionTree.js'

// A file the app's PHP OpmlCodec wrote: nco: namespace, _note, nested rows, an escaped "&" (#180).
const REAL_SAVED = `<?xml version="1.0" encoding="UTF-8"?>
<opml version="2.0" xmlns:nco="https://github.com/iannitram/nc-outliner/ns/1">
  <head>
    <title>Plan</title>
  </head>
  <body>
    <outline xmlns:nco="https://github.com/iannitram/nc-outliner/ns/1" text="A" _note="a note" nco:id="r1" nco:collapsed="true">
      <outline text="A1" nco:id="r2"/>
    </outline>
    <outline xmlns:nco="https://github.com/iannitram/nc-outliner/ns/1" text="B &amp; c" nco:id="r3"/>
  </body>
</opml>
`
const SHAPE = [
	{ text: 'A', note: 'a note', children: [{ text: 'A1', note: '', children: [] }] },
	{ text: 'B & c', note: '', children: [] },
]

describe('parseVersionTree (#180, #185)', () => {
	it('turns a real saved file into rows with notes, nested, all expanded', () => {
		const tree = parseVersionTree(REAL_SAVED)
		expect(tree).toMatchObject(SHAPE)
		expect(tree[0].collapsed).toBe(false)
		expect(new Set([tree[0].id, tree[0].children[0].id, tree[1].id]).size).toBe(3)
	})

	it('copes with a BOM and a leading newline', () => {
		expect(parseVersionTree('﻿' + REAL_SAVED)).toMatchObject(SHAPE)
		expect(parseVersionTree('\n' + REAL_SAVED)).toMatchObject(SHAPE)
	})

	it.each([
		['truncated XML', '<?xml version="1.0" encoding="UTF-8"?><opml version="2.0"><body><outline text="A"'],
		['an empty string', ''],
		['whitespace only', ' \n\t '],
		['not xml at all', 'not xml at all'],
		['an opml with no body', '<?xml version="1.0"?><opml version="2.0"><head><title>Plan</title></head></opml>'],
		['an HTML page', '<!DOCTYPE html><html><body>Login</body></html>'],
		['not a string', undefined],
	])('gives null for %s', (_label, input) => {
		expect(parseVersionTree(input)).toBeNull()
	})
})
