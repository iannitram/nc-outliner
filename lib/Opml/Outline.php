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
	 */
	public function __construct(
		public string $title = '',
		public array $rows = [],
		public ?string $publishPath = null,
		/** @var list<array{id: string, name: string, type: string, width: int, hidden: bool, summary?: string}> */
		public array $columns = [],
	) {
	}
}
