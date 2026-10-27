<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Odt;

use OCA\NcOutliner\Odt\ContentWriter;
use OCA\NcOutliner\Opml\Row;
use PHPUnit\Framework\TestCase;

final class ContentWriterTest extends TestCase {
	private const OFFICE_NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
	private const TEXT_NS = 'urn:oasis:names:tc:opendocument:xmlns:text:1.0';

	public function testWritesRootRowsAsLevelOneHeadingsAndPlacesNotesAfterThem(): void {
		$xml = $this->write([
			new Row('1', 'Plan', 'Why', false, [
				new Row('2', 'Goals', '', false, [new Row('3', 'Ship')]),
			]),
		]);
		$xpath = $this->xpath($xml);
		$elements = $xpath->query('/office:document-content/office:body/office:text/*');

		self::assertSame(['h:Plan', 'p:Why', 'h:Goals', 'list'], $this->describe($elements));
		self::assertSame('1', $xpath->evaluate('string(//text:h[1]/@text:outline-level)'));
		self::assertSame('Heading_20_1', $xpath->evaluate('string(//text:h[1]/@text:style-name)'));
	}

	public function testWritesSecondLevelRowsWithChildrenAsLevelTwoHeadings(): void {
		$xpath = $this->xpath($this->write([
			new Row('1', 'Plan', '', false, [new Row('2', 'Goals', '', false, [new Row('3', 'Ship')])]),
		]));

		self::assertSame('2', $xpath->evaluate('string(//text:h[2]/@text:outline-level)'));
		self::assertSame('Heading_20_2', $xpath->evaluate('string(//text:h[2]/@text:style-name)'));
		self::assertSame('Goals', $xpath->evaluate('string(//text:h[2])'));
	}

	public function testWritesChildrenAsNestedListItems(): void {
		$xpath = $this->xpath($this->write([
			new Row('1', 'Plan', '', false, [new Row('2', 'Goals', '', false, [new Row('3', 'Ship'), new Row('4', 'Test')])]),
		]));

		self::assertSame(['Ship', 'Test'], $this->texts($xpath, '//text:h[@text:outline-level="2"]/following-sibling::text:list[1]//text:list-item/text:p'));
	}

	public function testSecondLevelLeafStartsASeparateTopLevelBulletList(): void {
		$xpath = $this->xpath($this->write([
			new Row('1', 'Plan', '', false, [
				new Row('2', 'Goals', '', false, [new Row('3', 'Ship')]),
				new Row('4', 'Risks'),
			]),
		]));

		self::assertSame(['Goals'], $this->texts($xpath, '//text:h[@text:outline-level="2"]'));
		self::assertSame('Risks', $xpath->evaluate('string((//office:text/text:list)[last()]/text:list-item/text:p)'));
		self::assertSame(2, $xpath->query('//office:text/text:list')->length);
	}

	public function testWritesNotesInsideTheirListItemAfterTheRowText(): void {
		$xpath = $this->xpath($this->write([new Row('1', 'Plan', '', false, [new Row('2', 'Risk', 'Mitigation')])]));
		$paragraphs = $xpath->query('//text:list-item[text:p="Risk"]/*');

		self::assertSame(['Risk', 'Mitigation'], $this->texts($xpath, '//text:list-item[text:p="Risk"]/text:p'));
		self::assertSame('2', (string)$paragraphs->length);
	}

	public function testEscapesTextAndDeclaresOdfNamespacesInParseableXml(): void {
		$xml = $this->write([new Row('1', 'A & <B>')]);
		$document = new \DOMDocument();
		self::assertTrue($document->loadXML($xml));
		$xpath = new \DOMXPath($document);

		self::assertSame(self::OFFICE_NS, $xpath->evaluate('string(namespace-uri(/*))'));
		self::assertSame(self::TEXT_NS, $xpath->evaluate('string(namespace-uri(//text:h))'));
		self::assertSame('A & <B>', $xpath->evaluate('string(//text:h)'));
	}

	/** @param list<Row> $rows */
	private function write(array $rows): string {
		return (new ContentWriter())->contentXml($rows);
	}

	private function xpath(string $xml): \DOMXPath {
		$document = new \DOMDocument();
		self::assertTrue($document->loadXML($xml));
		$xpath = new \DOMXPath($document);
		$xpath->registerNamespace('office', self::OFFICE_NS);
		$xpath->registerNamespace('text', self::TEXT_NS);
		return $xpath;
	}

	private function describe(?\DOMNodeList $nodes): array {
		$result = [];
		foreach ($nodes ?? [] as $node) {
			$result[] = match ($node->localName) {
				'h' => 'h:' . $node->textContent,
				'p' => 'p:' . $node->textContent,
				'list' => 'list',
				default => $node->localName,
			};
		}
		return $result;
	}

	private function texts(\DOMXPath $xpath, string $expression): array {
		$nodes = $xpath->query($expression);
		$result = [];
		foreach ($nodes ?? [] as $node) {
			$result[] = $node->textContent;
		}
		return $result;
	}
}
