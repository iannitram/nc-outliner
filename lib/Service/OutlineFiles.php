<?php
declare(strict_types=1);

namespace OCA\Outliner\Service;

use InvalidArgumentException;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IUserSession;
use OCP\Lock\ILockingProvider;
use RuntimeException;

class OutlineFiles
{
    public function __construct(private IRootFolder $root, private IUserSession $session, private Opml $opml) {}

    private function folder(): Folder
    {
        $user = $this->session->getUser();
        if (!$user) {
            throw new RuntimeException('Sign in to open outlines.', 401);
        }
        $home = $this->root->getUserFolder($user->getUID());
        if (!$home->nodeExists('Outlines')) {
            try {
                return $home->newFolder('Outlines');
            } catch (\OCP\Files\AlreadyExistsException) {
                // Another request created the folder in the meantime.
            }
        }
        $folder = $home->get('Outlines');
        if (!$folder instanceof Folder) {
            throw new RuntimeException('Outlines exists and is not a folder.', 409);
        }
        return $folder;
    }

    private function name(string $name): string
    {
        if ($name === '' || strlen($name) > 240 || preg_match('/[\\\\\/\x00-\x1f\x7f]/', $name) || str_starts_with($name, '.') || !str_ends_with(strtolower($name), '.opml')) {
            throw new InvalidArgumentException('Use an OPML filename without a path.');
        }
        return $name;
    }

    private function file(string $name): File
    {
        $node = $this->folder()->get($this->name($name));
        if (!$node instanceof File) {
            throw new InvalidArgumentException('This outline is not a file.');
        }
        return $node;
    }

    public function listing(): array
    {
        $names = [];
        foreach ($this->folder()->getDirectoryListing() as $node) {
            if ($node instanceof File && str_ends_with(strtolower($node->getName()), '.opml')) {
                $names[] = $node->getName();
            }
        }
        natcasesort($names);
        return array_values($names);
    }

    public function create(string $name): array
    {
        $name = $this->name($name);
        $folder = $this->folder();
        $folder->lock(ILockingProvider::LOCK_EXCLUSIVE);
        try {
            if ($folder->nodeExists($name)) {
                throw new RuntimeException('An outline with that name already exists.', 409);
            }
            $folder->newFile($name, $this->opml->create(substr($name, 0, -5)));
        } finally {
            $folder->unlock(ILockingProvider::LOCK_EXCLUSIVE);
        }
        return $this->open($name);
    }

    public function open(string $name): array
    {
        $file = $this->file($name);
        $file->lock(ILockingProvider::LOCK_SHARED);
        try {
            return ['name' => $name, 'etag' => $file->getEtag(), 'document' => $this->opml->read($file->getContent())];
        } finally {
            $file->unlock(ILockingProvider::LOCK_SHARED);
        }
    }

    /** Keep the local outline as a new file; the conflicting original is never written. */
    public function keepCopy(string $name, array $document): array
    {
        $source = $this->file($name);
        $source->lock(ILockingProvider::LOCK_SHARED);
        try {
            $xml = $this->opml->write($document, $source->getContent());
        } finally {
            $source->unlock(ILockingProvider::LOCK_SHARED);
        }
        $folder = $this->folder();
        $folder->lock(ILockingProvider::LOCK_EXCLUSIVE);
        try {
            $stem = substr($name, 0, -5);
            do {
                // Reserve room below the filename limit and never replace a previous copy.
                $copyName = mb_strcut($stem, 0, 190, 'UTF-8') . ' (copy ' . bin2hex(random_bytes(6)) . ').opml';
            } while ($folder->nodeExists($copyName));
            $folder->newFile($copyName, $xml);
        } finally {
            $folder->unlock(ILockingProvider::LOCK_EXCLUSIVE);
        }
        return $this->open($copyName);
    }

    public function save(string $name, array $document, string $etag): array
    {
        $file = $this->file($name);
        $file->lock(ILockingProvider::LOCK_EXCLUSIVE);
        try {
            if ($etag === '' || !hash_equals($file->getEtag(), $etag)) {
                throw new RuntimeException('This outline changed elsewhere. Reopen it before saving.', 412);
            }
            $file->putContent($this->opml->write($document, $file->getContent()));
            return ['name' => $name, 'etag' => $file->getEtag()];
        } finally {
            $file->unlock(ILockingProvider::LOCK_EXCLUSIVE);
        }
    }
}
