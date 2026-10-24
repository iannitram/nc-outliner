<?php
declare(strict_types=1);

namespace OCA\Outliner\Service;

use DOMDocument;
use DOMElement;
use InvalidArgumentException;

/** OPML 2.0 with a namespaced extension; unknown XML is kept when editing. */
class Opml
{
    public const NS = 'https://nextcloud.com/ns/outliner/1';

    private function xml(string $xml): DOMDocument
    {
        if (strlen($xml) > 5 * 1024 * 1024 || stripos($xml, '<!DOCTYPE') !== false || stripos($xml, '<!ENTITY') !== false) {
            throw new InvalidArgumentException('Unsafe or oversized OPML file.');
        }
        $dom = new DOMDocument();
        $previous = libxml_use_internal_errors(true);
        try {
            if (!$dom->loadXML($xml, LIBXML_NONET) || $dom->documentElement?->tagName !== 'opml') {
                throw new InvalidArgumentException('Invalid OPML file.');
            }
        } finally {
            libxml_clear_errors();
            libxml_use_internal_errors($previous);
        }
        return $dom;
    }

    public function create(string $title): string
    {
        $dom = new DOMDocument('1.0', 'UTF-8');
        $root = $dom->appendChild($dom->createElement('opml'));
        $root->setAttribute('version', '2.0');
        $root->setAttributeNS('http://www.w3.org/2000/xmlns/', 'xmlns:nc', self::NS);
        $head = $root->appendChild($dom->createElement('head'));
        $head->appendChild($dom->createElement('title'))->appendChild($dom->createTextNode($title));
        $root->appendChild($dom->createElement('body'));
        return $dom->saveXML();
    }

    private function child(DOMElement $parent, string $name): ?DOMElement
    {
        foreach ($parent->childNodes as $node) {
            if ($node instanceof DOMElement && $node->tagName === $name) {
                return $node;
            }
        }
        return null;
    }

    private function rows(DOMElement $parent, array &$nodes, string $path = ''): array
    {
        $rows = [];
        foreach ($parent->childNodes as $node) {
            if (!$node instanceof DOMElement || $node->tagName !== 'outline') {
                continue;
            }
            $position = $path . '/' . count($rows);
            $id = $node->getAttributeNS(self::NS, 'id') ?: 'row-' . substr(hash('sha256', $position), 0, 24);
            if (isset($nodes[$id])) {
                throw new InvalidArgumentException('Duplicate row ID.');
            }
            $nodes[$id] = $node;
            $row = ['id' => $id, 'text' => $node->getAttribute('text'),
                'collapsed' => $node->getAttributeNS(self::NS, 'collapsed') === 'true',
                'children' => $this->rows($node, $nodes, $position)];
            if ($node->hasAttributeNS(self::NS, 'note')) {
                $row['note'] = $node->getAttributeNS(self::NS, 'note');
            }
            if ($node->hasAttributeNS(self::NS, 'note-visible')) {
                $row['noteVisible'] = $node->getAttributeNS(self::NS, 'note-visible') === 'true';
            }
            if ($node->hasAttributeNS(self::NS, 'checked')) {
                $row['checked'] = $node->getAttributeNS(self::NS, 'checked') === 'true';
            }
            $rows[] = $row;
        }
        return $rows;
    }

    public function read(string $xml): array
    {
        $dom = $this->xml($xml);
        $head = $this->child($dom->documentElement, 'head');
        $body = $this->child($dom->documentElement, 'body');
        if (!$body) {
            throw new InvalidArgumentException('OPML body is missing.');
        }
        $nodes = [];
        $document = ['title' => $head ? ($this->child($head, 'title')?->textContent ?? '') : '', 'rows' => $this->rows($body, $nodes)];
        if ($dom->documentElement->hasAttributeNS(self::NS, 'showCheckboxes')) {
            $document['showCheckboxes'] = $dom->documentElement->getAttributeNS(self::NS, 'showCheckboxes') === 'true';
        }
        if ($dom->documentElement->hasAttributeNS(self::NS, 'numbering-style')) {
            $style = $dom->documentElement->getAttributeNS(self::NS, 'numbering-style');
            $suffix = $dom->documentElement->getAttributeNS(self::NS, 'numbering-suffix');
            $document['numbering'] = $this->numbering(['style' => $style, 'suffix' => $suffix]);
        }
        return $document;
    }

    private function numbering(mixed $settings): array
    {
        if (!is_array($settings) || !in_array($settings['style'] ?? null, ['none', 'decimal', 'alpha', 'roman', 'section'], true)
            || !in_array($settings['suffix'] ?? null, ['.', ')', ':', ''], true)) {
            throw new InvalidArgumentException('Invalid row numbering.');
        }
        return ['style' => $settings['style'], 'suffix' => $settings['suffix']];
    }

    public function write(array $document, string $original): string
    {
        if (!is_string($document['title'] ?? null) || !is_array($document['rows'] ?? null)) {
            throw new InvalidArgumentException('Invalid outline document.');
        }
        $dom = $this->xml($original);
        $root = $dom->documentElement;
        if (array_key_exists('numbering', $document)) {
            $numbering = $this->numbering($document['numbering']);
            $root->setAttributeNS(self::NS, 'nc:numbering-style', $numbering['style']);
            $root->setAttributeNS(self::NS, 'nc:numbering-suffix', $numbering['suffix']);
        }
        if (array_key_exists('showCheckboxes', $document)) {
            if (!is_bool($document['showCheckboxes'])) {
                throw new InvalidArgumentException('Invalid checklist visibility.');
            }
            $root->setAttributeNS(self::NS, 'nc:showCheckboxes', $document['showCheckboxes'] ? 'true' : 'false');
        }
        $head = $this->child($root, 'head') ?? $root->insertBefore($dom->createElement('head'), $root->firstChild);
        $title = $this->child($head, 'title') ?? $head->appendChild($dom->createElement('title'));
        $title->textContent = $document['title'];
        $body = $this->child($root, 'body');
        if (!$body) {
            throw new InvalidArgumentException('OPML body is missing.');
        }
        $nodes = [];
        $this->rows($body, $nodes);
        $seen = [];
        $count = 0;
        $build = function (array $rows, int $depth = 0) use (&$build, &$seen, &$count, $dom, $nodes): array {
            if ($depth > 100) {
                throw new InvalidArgumentException('Outline is too deeply nested.');
            }
            $result = [];
            foreach ($rows as $row) {
                if (!is_array($row) || !is_string($row['id'] ?? null) || !preg_match('/^[A-Za-z0-9_-]{1,128}$/D', $row['id']) || isset($seen[$row['id']]) || !is_string($row['text'] ?? null) || !is_array($row['children'] ?? null) || ++$count > 10000) {
                    throw new InvalidArgumentException('Invalid outline row.');
                }
                $seen[$row['id']] = true;
                $node = isset($nodes[$row['id']]) ? $nodes[$row['id']]->cloneNode(true) : $dom->createElement('outline');
                foreach (iterator_to_array($node->childNodes) as $child) {
                    if ($child instanceof DOMElement && $child->tagName === 'outline') {
                        $node->removeChild($child);
                    }
                }
                if (array_key_exists('checked', $row)) {
                    if (!is_bool($row['checked'])) {
                        throw new InvalidArgumentException('Invalid checkbox status.');
                    }
                    $node->setAttributeNS(self::NS, 'nc:checked', $row['checked'] ? 'true' : 'false');
                }
                $node->setAttribute('text', $row['text']);
                $node->setAttributeNS(self::NS, 'nc:id', $row['id']);
                $node->setAttributeNS(self::NS, 'nc:collapsed', !empty($row['collapsed']) ? 'true' : 'false');
                if (array_key_exists('note', $row)) {
                    if (!is_string($row['note'])) {
                        throw new InvalidArgumentException('Invalid row note.');
                    }
                    $node->setAttributeNS(self::NS, 'nc:note', $row['note']);
                }
                if (array_key_exists('noteVisible', $row)) {
                    if (!is_bool($row['noteVisible'])) {
                        throw new InvalidArgumentException('Invalid note visibility.');
                    }
                    $node->setAttributeNS(self::NS, 'nc:note-visible', $row['noteVisible'] ? 'true' : 'false');
                }
                foreach ($build($row['children'], $depth + 1) as $child) {
                    $node->appendChild($child);
                }
                $result[] = $node;
            }
            return $result;
        };
        $replacement = $build($document['rows']);
        foreach (iterator_to_array($body->childNodes) as $node) {
            if ($node instanceof DOMElement && $node->tagName === 'outline') {
                $body->removeChild($node);
            }
        }
        foreach ($replacement as $node) {
            $body->appendChild($node);
        }
        $xml = $dom->saveXML();
        $this->xml($xml);
        return $xml;
    }
}
