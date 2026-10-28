<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Opml;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\OpmlParseException;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Opml\Row;
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

	public function testThrowsForEmptyOrBlankInput(): void {
		foreach (['', '   '] as $xml) {
			try {
				(new OpmlCodec())->parse($xml);
				$this->fail('Expected empty input to throw');
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

	public function testWritesNoteAttribute(): void {
		$outline = new Outline('T', [new Row('r1', 'A', 'n')]);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringContainsString('_note="n"', $xml);
		$this->assertStringNotContainsString('nco:note', $xml);
	}

	public function testWritesCollapsedAttribute(): void {
		$outline = new Outline('T', [new Row('r1', 'A', '', true)]);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringContainsString('nco:collapsed="true"', $xml);
	}

	public function testWritesNoCollapsedAttributeWhenFalse(): void {
		$outline = new Outline('T', [new Row('r1', 'A', '', false)]);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringNotContainsString('nco:collapsed="true"', $xml);
	}

	public function testWritesEscapedText(): void {
		$outline = new Outline('T', [new Row('r1', 'a & b < c "d"', '')]);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringContainsString('a &amp; b &lt; c &quot;d&quot;', $xml);
	}

	public function testRoundTrip(): void {
		$original = new Outline('Plan', [
			new Row('r1', 'A', 'a note', true, [
				new Row('r2', 'B', 'b note', false, [new Row('r3', 'C', '', true)]),
			]),
			new Row('r4', 'D', '', false),
		], '/Docs/P.odt');

		$codec = new OpmlCodec();
		$parsed = $codec->parse($codec->write($original));

		$this->assertEquals($original, $parsed);
	}

	public function testWritesNoNoteAttributeForEmptyNote(): void {
		$xml = (new OpmlCodec())->write(new Outline('T', [new Row('r1', 'A', '')]));

		$this->assertStringNotContainsString('_note', $xml);
	}

	public function testRoundTripWithSpecialCharacters(): void {
		$special = "a & b < c > d \" e\nf";
		$original = new Outline($special, [
			new Row('r1', $special, $special, true, [new Row('r2', $special . '2', $special, false)]),
		], '/Docs/P & Q.odt');

		$codec = new OpmlCodec();
		$parsed = $codec->parse($codec->write($original));

		$this->assertSame($original->title, $parsed->title);
		$this->assertSame('/Docs/P & Q.odt', $parsed->publishPath);
		$this->assertEquals($original, $parsed);
	}

	public function testWritesPublishPath(): void {
		$outline = new Outline('T', [], '/Docs/P.odt');

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringContainsString('<nco:publishPath>/Docs/P.odt</nco:publishPath>', $xml);
	}

	public function testWritesNoPublishPathWhenNull(): void {
		$outline = new Outline('T', [], null);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringNotContainsString('<nco:publishPath>', $xml);
	}

	public function testWritesEmptyBody(): void {
		$outline = new Outline('T', []);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringContainsString('<body/>', $xml);
		$this->assertSame([], (new OpmlCodec())->parse($xml)->rows);
	}

	public function testParsesNoteHiddenAttribute(): void {
		$outline = $this->parse('<body><outline text="A" _note="n" nco:noteHidden="true"/></body>');

		$this->assertSame('n', $outline->rows[0]->note);
		$this->assertTrue($outline->rows[0]->noteHidden);
	}

	public function testDefaultsNoteHiddenToFalse(): void {
		$outline = $this->parse('<body><outline text="A" _note="n"/></body>');

		$this->assertFalse($outline->rows[0]->noteHidden);
	}

	public function testWritesNoteHiddenAttribute(): void {
		$outline = new Outline('T', [new Row('r1', 'A', 'n', false, [], true)]);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringContainsString('nco:noteHidden="true"', $xml);
	}

	public function testWritesNoNoteHiddenAttributeWhenFalse(): void {
		$outline = new Outline('T', [new Row('r1', 'A', 'n')]);

		$xml = (new OpmlCodec())->write($outline);
		$this->assertStringNotContainsString('nco:noteHidden', $xml);
	}

	public function testRoundTripWithNoteHidden(): void {
		$original = new Outline('T', [
			new Row('r1', 'A', 'a note', false, [
				new Row('r2', 'B', '', false, [], true),
			], true),
		]);

		$codec = new OpmlCodec();
		$parsed = $codec->parse($codec->write($original));

		$this->assertEquals($original, $parsed);
	}

	public function testRowArrayRoundTripKeepsNoteHidden(): void {
		$row = new Row('r1', 'A', 'a note', true, [new Row('r2', 'B', '', false, [], true)], true);

		$parsed = Row::fromArray($row->toArray());

		$this->assertEquals($row, $parsed);
		$this->assertTrue($parsed->noteHidden);
	}
}
