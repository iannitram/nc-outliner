<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

/** Thrown when the user's Outlines path exists but is not a folder. */
final class FolderConflictException extends \RuntimeException {
	public function __construct() {
		parent::__construct('A file named Outlines already exists. Rename or remove it to use the outliner.');
	}
}
