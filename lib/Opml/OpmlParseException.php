<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Opml;

/** Thrown when OPML text cannot be read. Never comes with a partial tree. */
final class OpmlParseException extends \RuntimeException {
}
