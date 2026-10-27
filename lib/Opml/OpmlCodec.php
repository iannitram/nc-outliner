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
		throw new \LogicException('not implemented yet (#85)');
	}

	public function write(Outline $outline): string {
		throw new \LogicException('not implemented yet (#103)');
	}
}
