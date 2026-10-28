<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Opml;

/**
 * One row of an outline. Same fields as the JavaScript row (src/model/outline.js)
 * and the JSON the API sends, so toArray()/fromArray() are the wire format.
 */
final class Row {
	/**
	 * @param list<Row> $children
	 */
	public function __construct(
		public string $id,
		public string $text = '',
		public string $note = '',
		public bool $collapsed = false,
		public array $children = [],
		/** @var array<string, mixed> */
		public array $values = [],
	) {
	}

	/**
	 * @return array{id: string, text: string, note: string, collapsed: bool, children: list<array<string, mixed>>}
	 */
	public function toArray(): array {
		return [
			'id' => $this->id,
			'text' => $this->text,
			'note' => $this->note,
			'collapsed' => $this->collapsed,
			'children' => array_map(static fn (Row $child): array => $child->toArray(), $this->children),
			'values' => $this->values,
		];
	}

	/**
	 * @param array<string, mixed> $data
	 */
	public static function fromArray(array $data): Row {
		$children = [];
		foreach ((array)($data['children'] ?? []) as $child) {
			$children[] = self::fromArray((array)$child);
		}
		return new Row(
			(string)($data['id'] ?? ''),
			(string)($data['text'] ?? ''),
			(string)($data['note'] ?? ''),
			(bool)($data['collapsed'] ?? false),
			$children,
			(array)($data['values'] ?? []),
		);
	}
}
