<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

use OCA\NcOutliner\Odt\ContentWriter;
use OCA\NcOutliner\Odt\OdtPackage;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException as FilesNotFoundException;

final class PublishService {
	public function __construct(
		private readonly IOutlineStore $outlineStore,
		private readonly IRootFolder $rootFolder,
		private readonly ContentWriter $contentWriter,
		private readonly OdtPackage $odtPackage,
	) {
	}

	/** @return array{fileId: int, path: string} */
	public function publish(string $uid, int $outlineFileId, string $folder, string $name): array {
		if (in_array('..', explode('/', str_replace('\\', '/', $folder)), true)) {
			throw new \InvalidArgumentException('Folder path cannot contain ..');
		}
		if ($name === '' || preg_match('/[\\\\\/:*?"<>|]/', $name) === 1) {
			throw new \InvalidArgumentException('Invalid document name');
		}

		$userFolder = $this->rootFolder->getUserFolder($uid);
		try {
			$destination = $userFolder->get($folder);
		} catch (FilesNotFoundException) {
			throw new \InvalidArgumentException('Destination folder does not exist');
		}
		if (!$destination instanceof Folder) {
			throw new \InvalidArgumentException('Destination is not a folder');
		}

		$outline = $this->outlineStore->read($uid, $outlineFileId)['outline'];
		$bytes = $this->odtPackage->build($this->contentWriter->contentXml($outline->rows));
		$fileName = $name . '.odt';
		if ($destination->nodeExists($fileName)) {
			$file = $destination->get($fileName);
			if (!$file instanceof File) {
				throw new \InvalidArgumentException('Destination name is not a file');
			}
			$file->putContent($bytes);
		} else {
			$file = $destination->newFile($fileName, $bytes);
		}

		return ['fileId' => $file->getId(), 'path' => $userFolder->getRelativePath($file->getPath())];
	}
}
