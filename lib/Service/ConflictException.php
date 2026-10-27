<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

/**
 * Thrown when saving an outline with a stale etag.
 */
final class ConflictException extends \RuntimeException {
	public function __construct(public string $currentEtag) {
		parent::__construct("Conflict: current etag is {$currentEtag}");
	}
}
