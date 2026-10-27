<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Odt;

use OCA\NcOutliner\Opml\Row;

/**
 * Root rows -> the `content.xml` of an .odt, by the heading rule (ADR 0003).
 * Pure. Filled in by issue #87. See CODEMAP.md, "ODT writer".
 */
final class ContentWriter {
	/**
	 * @param list<Row> $rows
	 */
	public function contentXml(array $rows): string {
		$xml = new \XMLWriter();
		$xml->openMemory();
		$xml->startDocument('1.0', 'UTF-8');
		$xml->startElementNS('office', 'document-content', 'urn:oasis:names:tc:opendocument:xmlns:office:1.0');
		$xml->writeAttribute('office:version', '1.2');
		$xml->writeAttribute('xmlns:text', 'urn:oasis:names:tc:opendocument:xmlns:text:1.0');
		$xml->writeAttribute('xmlns:style', 'urn:oasis:names:tc:opendocument:xmlns:style:1.0');
		$xml->startElement('office:body');
		$xml->startElement('office:text');

		$listDepth = 0;
		$itemDepth = 0;
		$closeLists = static function (int $targetItems, int $targetLists) use ($xml, &$listDepth, &$itemDepth): void {
			while ($itemDepth > $targetItems) {
				$xml->endElement(); // text:list-item
				$itemDepth--;
			}
			while ($listDepth > $targetLists) {
				$xml->endElement(); // text:list
				$listDepth--;
			}
		};

		$writeRows = function (array $items, int $treeDepth, int $headingDepth) use (&$writeRows, $xml, $closeLists, &$listDepth, &$itemDepth): void {
			$baseItems = $itemDepth;
			$baseLists = $listDepth;
			foreach ($items as $row) {
				$isHeading = $treeDepth === 1 || ($treeDepth === 2 && $row->children !== []);
				if ($isHeading) {
					$closeLists(0, 0);
					$level = $treeDepth === 1 ? 1 : 2;
					$xml->startElement('text:h');
					$xml->writeAttribute('text:style-name', 'Heading_20_' . $level);
					$xml->writeAttribute('text:outline-level', (string)$level);
					$xml->text($row->text);
					$xml->endElement();
					if ($row->note !== '') {
						$xml->startElement('text:p');
						$xml->writeAttribute('text:style-name', 'Text_20_body');
						$xml->text($row->note);
						$xml->endElement();
					}
					$writeRows($row->children, $treeDepth + 1, $treeDepth);
					continue;
				}

				$depth = max(1, $treeDepth - $headingDepth);
				$closeLists($depth - 1, $depth);
				while ($listDepth < $depth) {
					$xml->startElement('text:list');
					$listDepth++;
				}
				$xml->startElement('text:list-item');
				$itemDepth++;
				$xml->startElement('text:p');
				$xml->writeAttribute('text:style-name', 'Text_20_body');
				$xml->text($row->text);
				$xml->endElement();
				if ($row->note !== '') {
					$xml->startElement('text:p');
					$xml->writeAttribute('text:style-name', 'Text_20_body');
					$xml->text($row->note);
					$xml->endElement();
				}
				$writeRows($row->children, $treeDepth + 1, $headingDepth);
			}
			$closeLists($baseItems, $baseLists);
		};

		$writeRows($rows, 1, 0);
		$xml->endElement(); // office:text
		$xml->endElement(); // office:body
		$xml->endElement(); // office:document-content
		$xml->endDocument();
		return $xml->outputMemory();
	}
}
