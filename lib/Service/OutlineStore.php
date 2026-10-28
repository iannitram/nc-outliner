<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\Outline;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException as OcpNotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\AlreadyExistsException;
use OCP\Lock\ILockingProvider;
use OCP\Lock\LockedException;

/**
 * OutlineStore service: manages the user's Outlines/ folder and .opml outline files.
 * Accesses files solely through Nextcloud's file API as the signed-in user.
 */
final class OutlineStore implements IOutlineStore {
	public function __construct(
		private readonly IRootFolder $rootFolder,
		private readonly OpmlCodec $codec,
		private readonly ILockingProvider $lockingProvider,
	) {
	}

	/**
	 * Creates the user's Outlines/ folder on first use.
	 */
	public function ensureFolder(string $uid): Folder {
		$userFolder = $this->rootFolder->getUserFolder($uid);
		if ($userFolder->nodeExists('Outlines')) {
			try {
				$folder = $userFolder->get('Outlines');
				if ($folder instanceof Folder) {
					return $folder;
				}
				throw new FolderConflictException();
			} catch (OcpNotFoundException) {
				// Recreate below if disappeared
			}
		}

		try {
			return $userFolder->newFolder('Outlines');
		} catch (NotPermittedException|AlreadyExistsException $e) {
			// Another request may have created the folder after nodeExists().
			try {
				$folder = $userFolder->get('Outlines');
			} catch (OcpNotFoundException) {
				throw $e;
			}

			if ($folder instanceof Folder) {
				return $folder;
			}

			throw new FolderConflictException();
		}
	}

	/**
	 * Returns .opml files in the user's Outlines folder, newest first.
	 *
	 * @return list<array{fileId: int, name: string, mtime: int}>
	 */
	public function list(string $uid): array {
		$folder = $this->ensureFolder($uid);
		$nodes = $folder->getDirectoryListing();

		$files = [];
		foreach ($nodes as $node) {
			if ($node instanceof File && str_ends_with(strtolower($node->getName()), '.opml')) {
				$files[] = $node;
			}
		}

		usort($files, static function (File $a, File $b): int {
			$cmp = $b->getMTime() <=> $a->getMTime();
			if ($cmp !== 0) {
				return $cmp;
			}
			return strcmp($a->getName(), $b->getName());
		});

		$result = [];
		foreach ($files as $file) {
			$result[] = [
				'fileId' => $file->getId(),
				'name' => $file->getName(),
				'mtime' => $file->getMTime(),
			];
		}

		return $result;
	}

	/**
	 * Creates a new outline file with an empty outline.
	 * Picks "Untitled" when name is empty.
	 *
	 * @return array{fileId: int, name: string, etag: string}
	 */
	public function create(string $uid, string $name): array {
		$baseName = $this->sanitizeAndValidateName($name);
		$folder = $this->ensureFolder($uid);
		$fileName = $this->pickAvailableFileName($folder, $baseName);

		$outline = new Outline($baseName, []);
		$xml = $this->codec->write($outline);

		$file = $folder->newFile($fileName);
		$file->putContent($xml);

		return [
			'fileId' => $file->getId(),
			'name' => $file->getName(),
			'etag' => $file->getEtag(),
		];
	}

	/**
	 * Reads an outline from the user's Outlines folder.
	 *
	 * @return array{fileId: int, name: string, etag: string, outline: Outline}
	 * @throws NotFoundException when fileId is not found or not an outline
	 */
	public function read(string $uid, int $fileId): array {
		$file = $this->getOutlineFile($uid, $fileId);
		$content = $file->getContent();
		$outline = $this->codec->parse($content);

		return [
			'fileId' => $file->getId(),
			'name' => $file->getName(),
			'etag' => $file->getEtag(),
			'outline' => $outline,
		];
	}

	/**
	 * Saves the outline with an etag guard.
	 *
	 * The etag check and the write run under an app-level exclusive lock on a key
	 * separate from the file's own lock, so two saves with the same If-Match cannot
	 * both pass the check, and putContent() can still take Nextcloud's own file lock.
	 * A save that finds the outline busy is refused as a conflict with the current etag.
	 *
	 * @throws ConflictException when $ifMatch does not match current etag, or the outline is locked by another write
	 * @throws NotFoundException when fileId is not found or not an outline
	 */
	public function save(string $uid, int $fileId, Outline $outline, string $ifMatch): string {
		$file = $this->getOutlineFile($uid, $fileId);
		$key = 'nc_outliner/save/' . $file->getId();

		try {
			$this->lockingProvider->acquireLock($key, ILockingProvider::LOCK_EXCLUSIVE, $file->getPath());
		} catch (LockedException) {
			throw new ConflictException($this->currentEtagOr($file, $ifMatch));
		}

		try {
			$currentEtag = $file->getEtag();

			if ($currentEtag !== $ifMatch) {
				throw new ConflictException($currentEtag);
			}

			$xml = $this->codec->write($outline);
			$file->putContent($xml);

			return $file->getEtag();
		} catch (LockedException) {
			// Locked by something else, e.g. the sync client or Files.
			throw new ConflictException($this->currentEtagOr($file, $ifMatch));
		} finally {
			$this->lockingProvider->releaseLock($key, ILockingProvider::LOCK_EXCLUSIVE);
		}
	}

	private function currentEtagOr(File $file, string $fallback): string {
		try {
			return $file->getEtag();
		} catch (\Throwable) {
			return $fallback;
		}
	}

	/**
	 * Saves a copy of the outline as "<name> (my copy).opml".
	 *
	 * @return array{fileId: int, name: string, etag: string}
	 * @throws NotFoundException when fileId is not found or not an outline
	 */
	public function saveCopy(string $uid, int $fileId, Outline $outline): array {
		$file = $this->getOutlineFile($uid, $fileId);
		$folder = $this->ensureFolder($uid);

		$originalName = $file->getName();
		if (str_ends_with(strtolower($originalName), '.opml')) {
			$baseName = substr($originalName, 0, -5);
		} else {
			$baseName = $originalName;
		}

		$copyBaseName = $baseName . ' (my copy)';
		$copyFileName = $this->pickAvailableFileName($folder, $copyBaseName);

		$xml = $this->codec->write($outline);

		$newFile = $folder->newFile($copyFileName);
		$newFile->putContent($xml);

		return [
			'fileId' => $newFile->getId(),
			'name' => $newFile->getName(),
			'etag' => $newFile->getEtag(),
		];
	}

	/**
	 * Looks up an outline file by fileId strictly within the user's Outlines folder.
	 *
	 * @throws NotFoundException
	 */
	private function getOutlineFile(string $uid, int $fileId): File {
		$folder = $this->ensureFolder($uid);
		try {
			$nodes = $folder->getById($fileId);
		} catch (OcpNotFoundException $e) {
			throw new NotFoundException("Outline file with id {$fileId} not found", 0, $e);
		}

		if ($nodes === []) {
			throw new NotFoundException("Outline file with id {$fileId} not found");
		}

		$node = $nodes[0];
		if (!($node instanceof File) || !str_ends_with(strtolower($node->getName()), '.opml')) {
			throw new NotFoundException("File with id {$fileId} is not an outline");
		}

		return $node;
	}

	/**
	 * Sanitizes and validates outline names: refuses \ / : * ? " < > | and trailing dots/spaces.
	 * Returns the base name without .opml.
	 *
	 * @throws \InvalidArgumentException
	 */
	private function sanitizeAndValidateName(string $name): string {
		if ($name === '') {
			return 'Untitled';
		}

		if (strpbrk($name, "\\/:*?\"<>|") !== false) {
			throw new \InvalidArgumentException('Name contains forbidden characters');
		}

		if (str_ends_with($name, '.') || str_ends_with($name, ' ')) {
			throw new \InvalidArgumentException('Name cannot have trailing dots or spaces');
		}

		if (str_ends_with(strtolower($name), '.opml')) {
			$baseName = substr($name, 0, -5);
			if ($baseName === '') {
				return 'Untitled';
			}
			if (str_ends_with($baseName, '.') || str_ends_with($baseName, ' ')) {
				throw new \InvalidArgumentException('Name cannot have trailing dots or spaces before extension');
			}
			return $baseName;
		}

		return $name;
	}

	/**
	 * Picks an available file name in the folder, picking "Name.opml", then "Name (2).opml", etc.
	 * Names differing only by case are treated as taken.
	 */
	private function pickAvailableFileName(Folder $folder, string $baseName): string {
		$existingNames = [];
		foreach ($folder->getDirectoryListing() as $node) {
			$existingNames[] = strtolower($node->getName());
		}

		$candidate = $baseName . '.opml';
		if (!in_array(strtolower($candidate), $existingNames, true)) {
			return $candidate;
		}

		$counter = 2;
		while (true) {
			$candidate = "{$baseName} ({$counter}).opml";
			if (!in_array(strtolower($candidate), $existingNames, true)) {
				return $candidate;
			}
			$counter++;
		}
	}
}
