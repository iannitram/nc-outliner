<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

use OCA\NcOutliner\Opml\Outline;

/** The outline operations used by the API controller. */
interface IOutlineStore {
	/** @return list<array{fileId: int, name: string, mtime: int}> */
	public function list(string $uid): array;

	/** @return array{fileId: int, name: string, etag: string} */
	public function create(string $uid, string $name): array;

	/** @return array{fileId: int, name: string, etag: string, outline: Outline} */
	public function read(string $uid, int $fileId): array;

	public function save(string $uid, int $fileId, Outline $outline, string $ifMatch): string;

	/** @return array{fileId: int, name: string, etag: string} */
	public function saveCopy(string $uid, int $fileId, Outline $outline): array;
}
