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
		throw new \LogicException('not implemented yet (#87)');
	}
}
