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
				if (!($child instanceof \DOMElement) || $this->isModelledHeadChild($child)) {
					continue;
				}
				// Copy into its own document so namespace declarations travel with it.
				$copy = new \DOMDocument();
				$copy->appendChild($copy->importNode($child, true));
				$headExtra[] = (string)$copy->saveXML($copy->documentElement);
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

	private function isModelledHeadChild(\DOMElement $child): bool {
		if ($child->namespaceURI === self::NS) {
			return $child->localName === 'publishPath';
		}

		return $child->namespaceURI === null && $child->localName === 'title';
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
			if ($uri === null && in_array($attribute->nodeName, ['text', '_note'], true)) {
				continue;
			}
			if ($uri === self::NS && in_array($attribute->localName, ['id', 'collapsed'], true)) {
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
		
		$opml->appendChild($head);
		
		foreach ($outline->headExtra as $xml) {
			$fragment = $document->createDocumentFragment();
			$previous = libxml_use_internal_errors(true);
			try {
				$ok = $fragment->appendXML($xml);
			} finally {
				libxml_clear_errors();
				libxml_use_internal_errors($previous);
			}
			if ($ok) {
				$head->appendChild($fragment);
			}
		}

		$body = $document->createElement('body');
		$declared = ['nco' => self::NS];
		foreach ($outline->rows as $row) {
			$this->writeRow($document, $body, $row, $opml, $declared);
		}
		$opml->appendChild($body);
		
		return $document->saveXML();
	}

	/**
	 * @param array<string, string> $declared prefix => URI declared on the root so far
	 */
	private function writeRow(\DOMDocument $document, \DOMElement $parent, Row $row, \DOMElement $root, array &$declared): void {
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

		$local = [];
		foreach ($row->extra as $name => $value) {
			$name = (string)$name;
			if (str_starts_with($name, 'xmlns:')) {
				$prefix = substr($name, 6);
				if (!isset($declared[$prefix])) {
					$declared[$prefix] = $value;
					$root->setAttribute($name, $value);
				} elseif ($declared[$prefix] !== $value) {
					$local[$prefix] = $value;
					$outline->setAttribute($name, $value);
				}
			}
		}
		foreach ($row->extra as $name => $value) {
			$name = (string)$name;
			if (str_starts_with($name, 'xmlns:')) {
				continue;
			}
			$colon = strpos($name, ':');
			if ($colon === false) {
				$outline->setAttribute($name, $value);
				continue;
			}
			$prefix = substr($name, 0, $colon);
			$uri = $prefix === 'xml' ? 'http://www.w3.org/XML/1998/namespace' : ($local[$prefix] ?? $declared[$prefix] ?? null);
			if ($uri !== null) {
				$outline->setAttributeNS($uri, $name, $value);
			}
		}

		foreach ($row->children as $child) {
			$this->writeRow($document, $outline, $child, $root, $declared);
		}
		
		$parent->appendChild($outline);
	}
}
