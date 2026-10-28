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
		$headExtra = [];
		if ($head !== null) {
			foreach ($head->childNodes as $child) {
				if ($child instanceof \DOMElement && !(($child->namespaceURI === null && $child->localName === 'title') || ($child->namespaceURI === self::NS && $child->localName === 'publishPath'))) {
					$copy = new \DOMDocument();
					$copy->appendChild($copy->importNode($child, true));
					$headExtra[] = (string)$copy->saveXML($copy->documentElement);
				}
			}
		}
		$rows = [];
		foreach ($body->childNodes as $child) {
			if ($child instanceof \DOMElement && $child->localName === 'outline') {
				$rows[] = $this->parseRow($child);
			}
		}

		return new Outline($title, $rows, $publishPath, $headExtra);
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
		$extra = [];
		foreach ($element->attributes as $attribute) {
			$uri = $attribute->namespaceURI;
			if (($uri === null && in_array($attribute->nodeName, ['text', '_note'], true)) || ($uri === self::NS && in_array($attribute->localName, ['id', 'collapsed'], true)) || str_starts_with($attribute->nodeName, 'xmlns')) {
				continue;
			}
			if ($uri !== null && $attribute->prefix !== 'xml') {
				$extra['xmlns:' . $attribute->prefix] = $uri;
			}
			$extra[$attribute->nodeName] = $attribute->value;
		}

		return new Row(
			$id,
			$element->getAttribute('text'),
			$element->getAttribute('_note'),
			$element->getAttributeNS(self::NS, 'collapsed') === 'true',
			$children,
			$extra,
		);
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
		foreach ($outline->headExtra as $xml) {
			$extraDocument = new \DOMDocument();
			$previous = libxml_use_internal_errors(true);
			try {
				$loaded = $extraDocument->loadXML($xml, LIBXML_NONET);
			} finally {
				libxml_clear_errors();
				libxml_use_internal_errors($previous);
			}
			$element = $extraDocument->documentElement;
			if (!$loaded || $element === null || ($element->namespaceURI === null && $element->localName === 'title') || ($element->namespaceURI === self::NS && $element->localName === 'publishPath')) {
				continue;
			}
			$head->appendChild($document->importNode($element, true));
		}
		
		$opml->appendChild($head);
		
		$body = $document->createElement('body');
		foreach ($outline->rows as $row) {
			$this->writeRow($document, $body, $row, $opml);
		}
		$opml->appendChild($body);
		
		return $document->saveXML();
	}

	private function writeRow(\DOMDocument $document, \DOMElement $parent, Row $row, \DOMElement $root): void {
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
		$localNamespaces = [];
		foreach ($row->extra as $name => $value) {
			if (str_starts_with($name, 'xmlns:')) {
				$prefix = substr($name, 6);
				if ($prefix === 'nco' || $prefix === 'xml') {
					continue;
				}
				if ($root->hasAttribute($name) && $root->getAttribute($name) !== $value) {
					$outline->setAttribute($name, $value);
					$localNamespaces[$prefix] = $value;
				} elseif (!$root->hasAttribute($name)) {
					$root->setAttribute($name, $value);
				}
			} elseif (str_contains($name, ':')) {
				[$prefix] = explode(':', $name, 2);
				$uri = $prefix === 'xml' ? 'http://www.w3.org/XML/1998/namespace' : ($prefix === 'nco' ? self::NS : ($localNamespaces[$prefix] ?? $row->extra['xmlns:' . $prefix] ?? null));
				if ($uri === self::NS && in_array(substr(strstr($name, ':'), 1), ['id', 'collapsed'], true)) {
					continue;
				}
				if ($uri !== null) {
					$outline->setAttributeNS($uri, $name, $value);
				}
			} elseif (!in_array($name, ['text', '_note'], true) && !str_starts_with($name, 'xmlns')) {
				$outline->setAttribute($name, $value);
			}
		}
		
		foreach ($row->children as $child) {
			$this->writeRow($document, $outline, $child, $root);
		}
		
		$parent->appendChild($outline);
	}
}
