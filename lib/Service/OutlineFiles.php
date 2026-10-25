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

    private function templateFolder(): Folder
    {
        $outlines = $this->folder();
        if (!$outlines->nodeExists('Templates')) {
            try { $outlines->newFolder('Templates'); }
            catch (\OCP\Files\AlreadyExistsException) { /* Another request created it. */ }
        }
        $templates = $outlines->get('Templates');
        if (!$templates instanceof Folder) throw new RuntimeException('Templates exists and is not a folder.', 409);
        return $templates;
    }

    private function templateName(string $name): string
    {
        return $this->name($name);
    }

    private function templateFile(string $name): File
    {
        $node = $this->templateFolder()->get($this->templateName($name));
        if (!$node instanceof File) throw new InvalidArgumentException('This template is not a file.');
        return $node;
    }

    /** Native Files calls acquire a shared lock before their exclusive upgrade.
     * Validate at the cancellable NC33 hook boundary instead of wrapping them in
     * an explicit exclusive Node lock, which fails under the Redis lock provider.
     */
    private function guarded(string $path, callable $check, callable $action): mixed
    {
        $user = $this->session->getUser();
        if (!$user) throw new RuntimeException('Sign in to open outlines.', 401);
        $home = $this->root->getUserFolder($user->getUID());
        if (!\OC\Files\Filesystem::$loaded
            || \OC\Files\Filesystem::getRoot() !== $home->getPath()
            || \OCP\Server::get(ILockingProvider::class) instanceof \OC\Lock\NoopLockingProvider) {
            throw new RuntimeException('Safe file updates require the signed-in Files context and file locking.');
        }
        $guard = new class($path, $check) {
            public bool $active = true;
            public bool $ran = false;
            public ?\Throwable $error = null;
            public function __construct(private string $path, private mixed $check) {}
            public function validate(array $params): void
            {
                if (!$this->active || ($params['oldpath'] ?? $params['path'] ?? null) !== '/Outlines/' . $this->path) return;
                $this->ran = true;
                try { ($this->check)(); }
                catch (\Throwable $error) { $this->error = $error; $params['run'] = false; }
            }
        };
        \OCP\Util::connectHook('OC_Filesystem', 'write', $guard, 'validate');
        try {
            try { $result = $action(); }
            catch (\Throwable $error) { throw $guard->error ?? $error; }
            if ($guard->error) throw $guard->error;
            if (!$guard->ran) throw new RuntimeException('The native Files update guard did not run.');
            return $result;
        } finally { $guard->active = false; }
    }

    private function createOnly(Folder $folder, string $relativePath, string $name, string $xml, callable $available): void
    {
        if ($folder->nodeExists($name)) throw new RuntimeException('A file with that name already exists.', 409);
        $this->guarded($relativePath, $available, fn () => $folder->newFile($name, $xml));
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

    /** Render current edits against the original XML without modifying the file. */
    public function export(string $name, array $document): array
    {
        $file = $this->file($name);
        $file->lock(ILockingProvider::LOCK_SHARED);
        try {
            return ['content' => $this->opml->write($document, $file->getContent())];
        } finally {
            $file->unlock(ILockingProvider::LOCK_SHARED);
        }
    }

    public function templates(): array
    {
        $names = [];
        foreach ($this->templateFolder()->getDirectoryListing() as $node) {
            if ($node instanceof File && str_ends_with(strtolower($node->getName()), '.opml')) $names[] = $node->getName();
        }
        natcasesort($names);
        return array_values($names);
    }

    /** Save a point-in-time editor snapshot under the current user's Files. */
    public function saveTemplate(string $name, string $source, string $etag, array $document): array
    {
        $name = $this->templateName($name);
        $sourceFile = $this->file($source);
        $sourceFile->lock(ILockingProvider::LOCK_SHARED);
        try {
            // FileInfo can be cached on this node before the shared lock is
            // acquired. Re-fetch the node now so the ETag check sees a writer
            // that committed between lookup and lock acquisition.
            $currentEtag = $this->file($source)->getEtag();
            if ($etag === '' || !hash_equals($currentEtag, $etag)) {
                throw new RuntimeException('This outline changed elsewhere. Reopen it before saving a template.', 412);
            }
            $xml = $this->opml->write($document, $sourceFile->getContent());
        } finally { $sourceFile->unlock(ILockingProvider::LOCK_SHARED); }
        $folder = $this->templateFolder();
        $available = static function () use ($folder, $name): void {
            if ($folder->nodeExists($name)) throw new RuntimeException('A template with that name already exists.', 409);
        };
        $this->createOnly($folder, 'Templates/' . $name, $name, $xml, $available);
        return ['name' => $name, 'document' => $document];
    }

    /** Create a distinct outline from a template; the stored template stays untouched. */
    public function fromTemplate(string $templateName, string $newName): array
    {
        $template = $this->templateFile($templateName);
        $template->lock(ILockingProvider::LOCK_SHARED);
        try {
            $xml = $template->getContent();
            $document = $this->opml->read($xml);
        } finally { $template->unlock(ILockingProvider::LOCK_SHARED); }
        $newName = $this->name($newName);
        $document['title'] = substr($newName, 0, -5);
        $xml = $this->opml->write($document, $xml);
        $folder = $this->folder();
        $available = static function () use ($folder, $newName): void {
            if ($folder->nodeExists($newName)) throw new RuntimeException('An outline with that name already exists.', 409);
        };
        $this->createOnly($folder, $newName, $newName, $xml, $available);
        return $this->open($newName);
    }
}
