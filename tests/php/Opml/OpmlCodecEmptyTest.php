<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Opml;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\OpmlParseException;
use PHPUnit\Framework\TestCase;

final class OpmlCodecEmptyTest extends TestCase {
	public function testParseOfAnEmptyStringThrowsOpmlParseException(): void {
		$this->expectException(OpmlParseException::class);

		(new OpmlCodec())->parse('');
	}

	public function testParseOfBrokenXmlThrowsOpmlParseException(): void {
		$this->expectException(OpmlParseException::class);

		(new OpmlCodec())->parse('<x');
	}
}
