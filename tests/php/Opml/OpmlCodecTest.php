<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Opml;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\OpmlParseException;
use PHPUnit\Framework\TestCase;

final class OpmlCodecTest extends TestCase {
	public function testParsesTitleAndDefaultRowValues(): void {
		$outline = $this->parse('<head><title>T</title></head><body><outline text="A"/></body>');

		$this->assertSame('T', $outline->title);
		$this->assertNull($outline->publishPath);
		$this->assertCount(1, $outline->rows);
		$this->assertSame('A', $outline->rows[0]->text);
		$this->assertSame('', $outline->rows[0]->note);
		$this->assertFalse($outline->rows[0]->collapsed);
		$this->assertSame([], $outline->rows[0]->children);
		$this->assertNotSame('', $outline->rows[0]->id);
	}

	public function testParsesPlainNoteAttribute(): void {
		$outline = $this->parse('<body><outline text="A" _note="n1"/></body>');

		$this->assertSame('n1', $outline->rows[0]->note);
	}

	public function testParsesNamespacedRowFieldsAndChildren(): void {
		$outline = $this->parse('<body><outline text="A" nco:id="r7" nco:collapsed="true"><outline text="B"/></outline></body>');

		$this->assertSame('r7', $outline->rows[0]->id);
		$this->assertTrue($outline->rows[0]->collapsed);
		$this->assertCount(1, $outline->rows[0]->children);
		$this->assertSame('B', $outline->rows[0]->children[0]->text);
	}

	public function testDecodesEscapedTextAttribute(): void {
		$outline = $this->parse('<body><outline text="a &amp; b &lt; c &quot;d&quot;"/></body>');

		$this->assertSame('a & b < c "d"', $outline->rows[0]->text);
	}

	public function testParsesPublishPath(): void {
		$outline = $this->parse('<head><nco:publishPath>/Docs/P.odt</nco:publishPath></head><body/>');

		$this->assertSame('/Docs/P.odt', $outline->publishPath);
	}

	public function testParsesRowsInDocumentOrderAtEveryLevel(): void {
		$outline = $this->parse('<body><outline text="A"><outline text="B"><outline text="C"/></outline></outline><outline text="D"/></body>');

		$this->assertSame(['A', 'D'], array_map(static fn ($row): string => $row->text, $outline->rows));
		$this->assertSame(['B'], array_map(static fn ($row): string => $row->text, $outline->rows[0]->children));
		$this->assertSame(['C'], array_map(static fn ($row): string => $row->text, $outline->rows[0]->children[0]->children));
	}

	public function testGeneratesDistinctIdsForRowsWithoutIds(): void {
		$outline = $this->parse('<body><outline text="A"/><outline text="B"/></body>');

		$this->assertNotSame('', $outline->rows[0]->id);
		$this->assertNotSame('', $outline->rows[1]->id);
		$this->assertNotSame($outline->rows[0]->id, $outline->rows[1]->id);
	}

	public function testThrowsForInvalidXmlAndMissingBody(): void {
		foreach (['<opml><body><outline text="A"></body>', '<opml xmlns:nco="' . OpmlCodec::NS . '"><head/></opml>'] as $xml) {
			try {
				(new OpmlCodec())->parse($xml);
				$this->fail('Expected invalid OPML to throw');
			} catch (OpmlParseException) {
				$this->addToAssertionCount(1);
			}
		}
	}

	private function parse(string $contents): \OCA\NcOutliner\Opml\Outline {
		return (new OpmlCodec())->parse(
			'<opml version="2.0" xmlns:nco="' . OpmlCodec::NS . '">' . $contents . '</opml>',
		);
	}
}
