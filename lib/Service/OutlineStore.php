<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Service;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\OpmlParseException;
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
		// Resolved before the lock only to check the file exists and to name the
		// lock; its etag may already be stale once we hold the lock.
		$file = $this->getOutlineFile($uid, $fileId);
		$key = 'nc_outliner/save/' . $fileId;

		try {
			$this->lockingProvider->acquireLock($key, ILockingProvider::LOCK_EXCLUSIVE, $file->getPath());
		} catch (LockedException) {
			throw new ConflictException($this->freshEtagOr($uid, $fileId, $ifMatch));
		}

		try {
			// A node's etag comes from the FileInfo loaded when it was resolved, so
			// look the file up again now that no other save can write in between.
			$current = $this->getOutlineFile($uid, $fileId);
			$currentEtag = $current->getEtag();

			if ($currentEtag !== $ifMatch) {
				throw new ConflictException($currentEtag);
			}

			$xml = $this->codec->write($outline);
			$current->putContent($xml);

			// The written node may keep its old FileInfo; read the new etag fresh.
			return $this->getOutlineFile($uid, $fileId)->getEtag();
		} catch (LockedException) {
			// Locked by something else, e.g. the sync client or Files.
			throw new ConflictException($this->freshEtagOr($uid, $fileId, $ifMatch));
		} finally {
			$this->lockingProvider->releaseLock($key, ILockingProvider::LOCK_EXCLUSIVE);
		}
	}

	private function freshEtagOr(string $uid, int $fileId, string $fallback): string {
		try {
			return $this->getOutlineFile($uid, $fileId)->getEtag();
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
	 * Renames an outline (#218, #219): the file becomes "<name>.opml" and the outline's
	 * own title becomes <name>, so the top bar and the list agree. A name already taken by
	 * another outline gets " (2)" and so on; changing only the case keeps the file's slot.
	 * Runs under the same app lock as save(), so a rename cannot interleave with a save.
	 *
	 * @return array{fileId: int, name: string, etag: string}
	 * @throws NotFoundException when fileId is not found or not an outline
	 * @throws ConflictException when a save holds the outline right now
	 * @throws \InvalidArgumentException when the name is not allowed
	 */
	public function rename(string $uid, int $fileId, string $name): array {
		$baseName = $this->sanitizeAndValidateName(trim($name));
		$file = $this->getOutlineFile($uid, $fileId);
		$key = 'nc_outliner/save/' . $fileId;

		try {
			$this->lockingProvider->acquireLock($key, ILockingProvider::LOCK_EXCLUSIVE, $file->getPath());
		} catch (LockedException) {
			throw new ConflictException($this->freshEtagOr($uid, $fileId, $file->getEtag()));
		}

		try {
			$folder = $this->ensureFolder($uid);
			$current = $this->getOutlineFile($uid, $fileId);
			$fileName = $current->getName();
			if ($fileName !== $baseName . '.opml') {
				$fileName = $this->pickAvailableFileName($folder, $baseName, $current->getName());
				$current->move(rtrim($folder->getPath(), '/') . '/' . $fileName);
				$current = $this->getOutlineFile($uid, $fileId);
			}

			try {
				$outline = $this->codec->parse($current->getContent());
				if ($outline->title !== $baseName) {
					$outline->title = $baseName;
					$current->putContent($this->codec->write($outline));
					$current = $this->getOutlineFile($uid, $fileId);
				}
			} catch (OpmlParseException) {
				// An unreadable file is still renamed; its title is left as it is.
			}

			return [
				'fileId' => $current->getId(),
				'name' => $current->getName(),
				'etag' => $current->getEtag(),
			];
		} catch (LockedException) {
			throw new ConflictException($this->freshEtagOr($uid, $fileId, $file->getEtag()));
		} finally {
			$this->lockingProvider->releaseLock($key, ILockingProvider::LOCK_EXCLUSIVE);
		}
	}

	/**
	 * Duplicates an outline as "<name> (copy).opml" (then " (copy) (2)" and so on), with the
	 * copy's title set to match its file name (#219).
	 *
	 * @return array{fileId: int, name: string, etag: string}
	 * @throws NotFoundException when fileId is not found or not an outline
	 */
	public function duplicate(string $uid, int $fileId): array {
		$file = $this->getOutlineFile($uid, $fileId);
		$folder = $this->ensureFolder($uid);
		$copyBaseName = $this->baseName($file->getName()) . ' (copy)';
		$copyFileName = $this->pickAvailableFileName($folder, $copyBaseName);

		$content = $file->getContent();
		try {
			$outline = $this->codec->parse($content);
			$outline->title = $this->baseName($copyFileName);
			$content = $this->codec->write($outline);
		} catch (OpmlParseException) {
			// Copy an unreadable file byte for byte.
		}

		$newFile = $folder->newFile($copyFileName);
		$newFile->putContent($content);

		return [
			'fileId' => $newFile->getId(),
			'name' => $newFile->getName(),
			'etag' => $newFile->getEtag(),
		];
	}

	/**
	 * Deletes an outline (#219). Nextcloud moves it to the user's trash bin when the
	 * Deleted files app is on, so it can be restored from Files.
	 *
	 * @throws NotFoundException when fileId is not found or not an outline
	 */
	public function delete(string $uid, int $fileId): void {
		$this->getOutlineFile($uid, $fileId)->delete();
	}

	/**
	 * The outline file as stored, for Export (#219).
	 *
	 * @return array{name: string, content: string}
	 * @throws NotFoundException when fileId is not found or not an outline
	 */
	public function download(string $uid, int $fileId): array {
		$file = $this->getOutlineFile($uid, $fileId);
		return ['name' => $file->getName(), 'content' => $file->getContent()];
	}

	private function baseName(string $fileName): string {
		return str_ends_with(strtolower($fileName), '.opml') ? substr($fileName, 0, -5) : $fileName;
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

		if (str_starts_with($name, '.')) {
			throw new \InvalidArgumentException('Name cannot start with a dot');
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
	 * Names differing only by case are treated as taken. $ownName, when given, is not counted.
	 */
	private function pickAvailableFileName(Folder $folder, string $baseName, ?string $ownName = null): string {
		$existingNames = [];
		foreach ($folder->getDirectoryListing() as $node) {
			if ($ownName !== null && $node->getName() === $ownName) {
				continue; // a rename may keep its own slot, e.g. to change only the case
			}
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
