<?php
declare(strict_types=1);

namespace OCA\Outliner\Service;

use OCP\Files\Folder;
use OCP\Files\IRootFolder;

class OutlineStorage
{
    public const FOLDER = 'Outlines';

    public function __construct(private IRootFolder $root)
    {
    }

    public function list(string $uid): array
    {
        $items = [];
        foreach ($this->folder($uid)->getDirectoryListing() as $file) {
            $name = $file->getName();
            if (str_ends_with(strtolower($name), '.opml')) {
                $items[] = ['name' => $name, 'mtime' => (int) $file->getMTime(), 'size' => (int) $file->getSize()];
            }
        }
        usort($items, static fn(array $a, array $b): int => $b['mtime'] <=> $a['mtime']);
        return $items;
    }

    public function read(string $uid, string $name): array
    {
        $file = $this->folder($uid)->get($name);
        return ['name' => $name, 'content' => $file->getContent(), 'etag' => $file->getEtag()];
    }

    public function create(string $uid, string $name, string $content): array
    {
        $file = $this->folder($uid)->newFile($name, $content);
        return ['name' => $name, 'etag' => $file->getEtag()];
    }

    private function folder(string $uid): Folder
    {
        $userFolder = $this->root->getUserFolder($uid);
        if (!$userFolder->nodeExists(self::FOLDER)) {
            return $userFolder->newFolder(self::FOLDER);
        }
        return $userFolder->get(self::FOLDER);
    }
}
