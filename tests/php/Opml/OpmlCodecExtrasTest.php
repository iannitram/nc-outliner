<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Opml;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\Row;
use PHPUnit\Framework\TestCase;

final class OpmlCodecExtrasTest extends TestCase {
	private const FILE = '<?xml version="1.0"?>'
		. '<opml version="2.0" xmlns:foo="urn:foo">'
		. '<head><title>T</title><dateCreated>Mon, 01 Jan 2024 00:00:00 GMT</dateCreated>'
		. '<ownerName>Someone</ownerName></head>'
		. '<body><outline text="A" _status="checked" type="link" foo:bar="1">'
		. '<outline text="B" created="x"/></outline></body></opml>';

	public function testExtrasSurviveWriteAndParse(): void {
		$codec = new OpmlCodec();
		$first = $codec->parse(self::FILE);

		$this->assertSame('checked', $first->rows[0]->extra['_status']);
		$this->assertSame('link', $first->rows[0]->extra['type']);
		$this->assertSame('1', $first->rows[0]->extra['foo:bar']);
		$this->assertCount(2, $first->headExtra);

		$xml = $codec->write($first);
		$this->assertStringContainsString('_status="checked"', $xml);
		$this->assertStringContainsString('type="link"', $xml);
		$this->assertStringContainsString('foo:bar="1"', $xml);
		$this->assertStringContainsString('xmlns:foo="urn:foo"', $xml);
		$this->assertStringContainsString('<dateCreated>Mon, 01 Jan 2024 00:00:00 GMT</dateCreated>', $xml);
		$this->assertStringContainsString('<ownerName>Someone</ownerName>', $xml);

		$second = $codec->parse($xml);
		$this->assertSame($first->rows[0]->extra, $second->rows[0]->extra);
		$this->assertSame(['created' => 'x'], $second->rows[0]->children[0]->extra);
		$this->assertSame($first->headExtra, $second->headExtra);
		$this->assertSame('T', $second->title);
	}

	public function testWrittenXmlIsWellFormed(): void {
		$xml = (new OpmlCodec())->write((new OpmlCodec())->parse(self::FILE));

		$document = new \DOMDocument();
		$this->assertTrue($document->loadXML($xml));
	}

	public function testNamespacedHeadElementRoundTrips(): void {
		$codec = new OpmlCodec();
		$outline = $codec->parse('<opml xmlns:foo="urn:foo"><head><foo:meta k="v">z</foo:meta></head><body/></opml>');
		$again = $codec->parse($codec->write($outline));

		$this->assertCount(1, $again->headExtra);
		$this->assertSame($outline->headExtra, $again->headExtra);
		$this->assertStringContainsString('k="v"', $again->headExtra[0]);
	}

	public function testRowExtraSurvivesArrayRoundTrip(): void {
		$row = new Row('r1', 'A', '', false, [], ['_status' => 'checked', 'foo:bar' => '1']);
		$data = $row->toArray();

		$this->assertSame(['_status' => 'checked', 'foo:bar' => '1'], $data['extra']);
		$this->assertEquals($row, Row::fromArray($data));
		$this->assertSame([], Row::fromArray(['id' => 'x'])->extra);
		$this->assertSame(['a' => 'b'], Row::fromArray(['id' => 'x', 'extra' => ['a' => 'b', 'n' => 3]])->extra);
	}

	public function testFileWithoutExtrasHasNone(): void {
		$outline = (new OpmlCodec())->parse('<opml><head><title>T</title></head><body><outline text="A"/></body></opml>');

		$this->assertSame([], $outline->headExtra);
		$this->assertSame([], $outline->rows[0]->extra);
	}
}
