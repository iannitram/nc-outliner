<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

/**
 * Thrown when an outline file id is not found in the user's Outlines folder or is not an outline.
 */
final class NotFoundException extends \RuntimeException {
}
