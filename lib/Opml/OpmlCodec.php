<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Opml;

/**
 * OPML text <-> Outline. Pure: no Nextcloud, no files.
 * App fields live in the namespace below; notes use OPML's standard `_note`.
 * Filled in by issues #85 (parse) and #103 (write). See CODEMAP.md, "OPML codec".
 */
final class OpmlCodec {
	public const NS = 'https://github.com/iannitram/nc-outliner/ns/1';

	/**
	 * @throws OpmlParseException on invalid XML or a missing <body>
	 */
	public function parse(string $xml): Outline {
		if (trim($xml) === '') {
			throw new OpmlParseException('Empty OPML file');
		}

		$previousUseInternalErrors = libxml_use_internal_errors(true);

		try {
			$document = new \DOMDocument();
			if (!$document->loadXML($xml, LIBXML_NONET)) {
				throw new OpmlParseException('Invalid OPML XML');
			}
		} finally {
			libxml_clear_errors();
			libxml_use_internal_errors($previousUseInternalErrors);
		}

		$root = $document->documentElement;
		$head = $this->childElement($root, 'head');
		$body = $this->childElement($root, 'body');
		if ($body === null) {
			throw new OpmlParseException('OPML has no body');
		}

		$title = $head === null ? '' : ($this->childElement($head, 'title')?->textContent ?? '');
		$publishPath = $head === null ? null : $this->namespacedChildText($head, 'publishPath');
		$columns = $head === null ? [] : $this->namespacedJsonChild($head, 'columns', []);
		$rows = [];
		foreach ($body->childNodes as $child) {
			if ($child instanceof \DOMElement && $child->localName === 'outline') {
				$rows[] = $this->parseRow($child);
			}
		}

		return new Outline($title, $rows, $publishPath, $columns);
	}

	private function childElement(\DOMElement $parent, string $name): ?\DOMElement {
		foreach ($parent->childNodes as $child) {
			if ($child instanceof \DOMElement && $child->localName === $name) {
				return $child;
			}
		}

		return null;
	}

	private function namespacedChildText(\DOMElement $parent, string $name): ?string {
		foreach ($parent->childNodes as $child) {
			if ($child instanceof \DOMElement && $child->namespaceURI === self::NS && $child->localName === $name) {
				return $child->textContent;
			}
		}

		return null;
	}

	private function namespacedJsonChild(\DOMElement $parent, string $name, array $default): array {
		$value = $this->namespacedChildText($parent, $name);
		if ($value === null || $value === '') {
			return $default;
		}
		$decoded = json_decode($value, true);
		return is_array($decoded) ? $decoded : $default;
	}

	private function parseRow(\DOMElement $element): Row {
		$children = [];
		foreach ($element->childNodes as $child) {
			if ($child instanceof \DOMElement && $child->localName === 'outline') {
				$children[] = $this->parseRow($child);
			}
		}

		$id = $element->hasAttributeNS(self::NS, 'id')
			? $element->getAttributeNS(self::NS, 'id')
			: bin2hex(random_bytes(8));

		return new Row(
			$id,
			$element->getAttribute('text'),
			$element->getAttribute('_note'),
			$element->getAttributeNS(self::NS, 'collapsed') === 'true',
			$children,
			$this->namespacedJsonAttribute($element, 'values', []),
		);
	}

	private function namespacedJsonAttribute(\DOMElement $element, string $name, array $default): array {
		if (!$element->hasAttributeNS(self::NS, $name)) {
			return $default;
		}
		$decoded = json_decode($element->getAttributeNS(self::NS, $name), true);
		return is_array($decoded) ? $decoded : $default;
	}

	public function write(Outline $outline): string {
		$document = new \DOMDocument('1.0', 'UTF-8');
		$document->formatOutput = true;
		
		$opml = $document->createElement('opml');
		$opml->setAttribute('version', '2.0');
		$opml->setAttribute('xmlns:nco', self::NS);
		$document->appendChild($opml);
		
		$head = $document->createElement('head');
		$title = $document->createElement('title');
		$title->textContent = $outline->title;
		$head->appendChild($title);
		
		if ($outline->publishPath !== null) {
			$publishPath = $document->createElement('nco:publishPath');
			$publishPath->textContent =$outline->publishPath;
			$head->appendChild($publishPath);
		}
		if ($outline->columns !== []) {
			$columns = $document->createElement('nco:columns');
			$columns->textContent = json_encode($outline->columns, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
			$head->appendChild($columns);
		}
		
		$opml->appendChild($head);
		
		$body = $document->createElement('body');
		foreach ($outline->rows as $row) {
			$this->writeRow($document, $body, $row);
		}
		$opml->appendChild($body);
		
		return $document->saveXML();
	}

	private function writeRow(\DOMDocument $document, \DOMElement $parent, Row $row): void {
		$outline = $document->createElement('outline');
		// Let DOM handle escaping properly
		$outline->setAttribute('text', $row->text);
		if ($row->note !== '') {
			$outline->setAttribute('_note', $row->note);
		}
		$outline->setAttributeNS(self::NS, 'nco:id', $row->id);
		if ($row->collapsed) {
			$outline->setAttributeNS(self::NS, 'nco:collapsed', 'true');
		}
		if ($row->values !== []) {
			$outline->setAttributeNS(self::NS, 'nco:values', json_encode($row->values, JSON_THROW_ON_ERROR | JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES));
		}
		
		foreach ($row->children as $child) {
			$this->writeRow($document, $outline, $child);
		}
		
		$parent->appendChild($outline);
	}
}
