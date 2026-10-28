<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

use OCA\NcOutliner\Odt\ContentWriter;
use OCA\NcOutliner\Odt\OdtPackage;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\IURLGenerator;

final class PublishService {
	public function __construct(
		private readonly IRootFolder $rootFolder,
		private readonly IOutlineStore $outlineStore,
		private readonly ContentWriter $contentWriter,
		private readonly OdtPackage $package,
		private readonly IURLGenerator $urlGenerator,
	) {
	}

	/** @return array{fileId: int, path: string, openUrl: string} */
	public function publish(string $uid, int $outlineFileId, string $folderPath, string $name): array {
		if (str_contains($folderPath, '\\') || preg_match('~(^|/)\.\.(/|$)~', $folderPath) === 1 || preg_match('/[\x00-\x1f\x7f]/', $folderPath) === 1) {
			throw new \InvalidArgumentException('Choose a folder inside your Files');
		}
		if ($name === '' || strpbrk($name, "\\/:*?\"<>|") !== false || preg_match('/[\x00-\x1f\x7f]/', $name) === 1 || str_ends_with($name, '.') || str_ends_with($name, ' ')) {
			throw new \InvalidArgumentException('Name contains invalid characters');
		}
		$baseName = str_ends_with(strtolower($name), '.odt') ? substr($name, 0, -4) : $name;
		if ($baseName === '') {
			throw new \InvalidArgumentException('Name contains invalid characters');
		}

		$outline = $this->outlineStore->read($uid, $outlineFileId)['outline'];
		$bytes = $this->package->build($this->contentWriter->contentXml($outline->rows));
		$userFolder = $this->rootFolder->getUserFolder($uid);
		if (trim($folderPath, '/') === '') {
			$targetFolder = $userFolder;
		} else {
			try {
				$targetFolder = $userFolder->get(ltrim($folderPath, '/'));
			} catch (NotFoundException $e) {
				throw new \InvalidArgumentException('Choose an existing folder inside your Files', 0, $e);
			}
		}
		if (!$targetFolder instanceof Folder) {
			throw new \InvalidArgumentException('Choose a folder inside your Files');
		}

		$fileName = $baseName . '.odt';
		if ($targetFolder->nodeExists($fileName)) {
			$existing = $targetFolder->get($fileName);
			if (!$existing instanceof File) {
				throw new \InvalidArgumentException('A folder already uses this document name');
			}
			$existing->putContent($bytes);
			$file = $existing;
		} else {
			$file = $targetFolder->newFile($fileName);
			$file->putContent($bytes);
		}

		$normalizedFolder = trim(ltrim($folderPath, '/'), '/');
		$path = ($normalizedFolder === '' ? '' : '/' . $normalizedFolder) . '/' . $fileName;
		$openUrl = $this->urlGenerator->linkToRouteAbsolute('files.view.index', [
			'dir' => '/' . $normalizedFolder,
			'openfile' => true,
			'fileid' => $file->getId(),
		]);
		return ['fileId' => $file->getId(), 'path' => $path, 'openUrl' => $openUrl];
	}
}
