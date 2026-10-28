<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Opml;

/**
 * A whole outline: the OPML head fields the app keeps, plus the root rows.
 * publishPath is where Publish to Doc last saved (null before the first publish).
 */
final class Outline {
	/**
	 * @param list<Row> $rows
	 * @param list<string> $headExtra serialized XML of unmodelled head elements
	 */
	public function __construct(
		public string $title = '',
		public array $rows = [],
		public ?string $publishPath = null,
		public array $headExtra = [],
	) {
	}
}
