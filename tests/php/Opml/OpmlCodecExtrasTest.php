<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Opml;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\Row;
use PHPUnit\Framework\TestCase;

final class OpmlCodecExtrasTest extends TestCase {
	public function testUnknownRowAttributesAndHeadElementsSurviveRoundTrip(): void {
		$codec = new OpmlCodec();
		$outline = $codec->parse('<opml xmlns:foo="urn:foo"><head><title>T</title><dateCreated>today</dateCreated><ownerName>A</ownerName></head><body><outline text="x" _status="checked" type="x" foo:flag="yes"/></body></opml>');
		$this->assertSame('checked', $outline->rows[0]->extra['_status']);
		$this->assertSame('urn:foo', $outline->rows[0]->extra['xmlns:foo']);
		$xml = $codec->write($outline);
		$again = $codec->parse($xml);
		$this->assertSame($outline->rows[0]->extra, $again->rows[0]->extra);
		$this->assertCount(2, $again->headExtra);
		$this->assertStringContainsString('dateCreated', implode('', $again->headExtra));
		$this->assertStringContainsString('ownerName', implode('', $again->headExtra));
	}

	public function testExtraAttributesSurviveTheRowApiAndCannotOverrideManagedFields(): void {
		$row = Row::fromArray(['id' => 'id1', 'text' => 'managed', 'extra' => ['_status' => 'checked', 'text' => 'override']]);
		$this->assertSame(['_status' => 'checked', 'text' => 'override'], $row->toArray()['extra']);
		$xml = (new OpmlCodec())->write(new \OCA\NcOutliner\Opml\Outline('', [$row]));
		$this->assertStringContainsString('text="managed"', $xml);
		$this->assertStringContainsString('_status="checked"', $xml);
	}
}
