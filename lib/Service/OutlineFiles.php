<?php
declare(strict_types=1);

namespace OCA\Outliner\Service;

use InvalidArgumentException;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IUserSession;
use OCP\IConfig;
use OCP\Lock\ILockingProvider;
use RuntimeException;

class OutlineFiles
{
    public function __construct(private IRootFolder $root, private IUserSession $session, private Opml $opml, private ?IConfig $config = null) {}

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

    private function path(string $path): string
    {
        $parts = explode('/', $path);
        foreach ($parts as $part) {
            if ($part === '' || $part === '.' || $part === '..' || str_ends_with(strtolower($part), '.part') || str_starts_with($part, '.') || strlen($part) > 240 || preg_match('/[\\\\\x00-\x1f\x7f]/', $part)) {
                throw new InvalidArgumentException('Use a relative path inside Outlines.');
            }
        }
        $this->name(array_pop($parts));
        return $path;
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
        $node = $this->folder()->get($this->path($name));
        if (!$node instanceof File) {
            throw new InvalidArgumentException('This outline is not a file.');
        }
        return $node;
    }

    public function listing(): array
    {
        $names = [];
        $visit = function (Folder $folder, string $prefix = '') use (&$visit, &$names): void {
            foreach ($folder->getDirectoryListing() as $node) {
                $path = $prefix . $node->getName();
                if ($node instanceof Folder && !str_starts_with($node->getName(), '.')) {
                    $visit($node, $path . '/');
                } elseif ($node instanceof File && str_ends_with(strtolower($node->getName()), '.opml')) {
                    try { $names[] = $this->path($path); } catch (InvalidArgumentException) {}
                }
            }
        };
        $visit($this->folder());
        natcasesort($names);
        return array_values($names);
    }

    /** Validate under the native Files API shared lock before its exclusive upgrade.
     * Explicit Node locks cannot wrap putContent/move: their own upgrade would fail.
     * Nextcloud 33 emits legacy write/rename hooks (without a pre_ prefix).
     * Their run parameter is a reference; OC_Hook otherwise swallows exceptions.
     */
    private function guarded(string $event, string $path, callable $check, callable $action, ?callable $completed = null): mixed
    {
        // These are the conditions used by View::shouldEmitHooks. Refuse mutation
        // when the current user's native hook/locking context is unavailable.
        $home = $this->root->getUserFolder($this->session->getUser()->getUID());
        if (!\OC\Files\Filesystem::$loaded
            || \OC\Files\Filesystem::getRoot() !== $home->getPath()
            || \OCP\Server::get(ILockingProvider::class) instanceof \OC\Lock\NoopLockingProvider) {
            throw new RuntimeException('Safe file updates require the signed-in Files context and file locking.');
        }
        $guard = new class($path, $check, $completed) {
            public bool $active = true;
            public bool $ran = false;
            public bool $finished = false;
            public mixed $result = null;
            public ?\Throwable $error = null;
            public function __construct(private string $path, private mixed $check, private mixed $completed) {}
            public function validate(array $params): void
            {
                if (!$this->active || ($params['oldpath'] ?? $params['path'] ?? null) !== '/Outlines/' . $this->path) return;
                $this->ran = true;
                try { ($this->check)(); }
                catch (\Throwable $error) { $this->error = $error; $params['run'] = false; }
            }
            public function complete(array $params): void
            {
                if (!$this->active || ($params['path'] ?? null) !== '/Outlines/' . $this->path) return;
                try { $this->result = ($this->completed)(); $this->finished = true; }
                catch (\Throwable $error) { $this->error = $error; }
            }
        };
        \OCP\Util::connectHook('OC_Filesystem', $event, $guard, 'validate');
        if ($completed) \OCP\Util::connectHook('OC_Filesystem', 'post_' . $event, $guard, 'complete');
        try {
            try { $result = $action(); }
            catch (\Throwable $error) { throw $guard->error ?? $error; }
            if ($guard->error) throw $guard->error;
            if (!$guard->ran) throw new RuntimeException('The native Files update guard did not run.');
            if ($completed && !$guard->finished) throw new RuntimeException('The native Files completion guard did not run.');
            return $completed ? $guard->result : $result;
        } finally { $guard->active = false; }
    }

    private function available(string $name): void
    {
        if ($this->folder()->nodeExists($name)) throw new RuntimeException('An outline with that name already exists.', 409);
    }

    private function unchanged(string $name, string $etag): void
    {
        // Re-fetch the node: File::getEtag() caches its FileInfo on each instance.
        if ($etag === '' || !hash_equals($this->file($name)->getEtag(), $etag)) {
            throw new RuntimeException('This outline changed elsewhere. Reopen it before saving or moving.', 412);
        }
    }

    public function create(string $name): array
    {
        $name = $this->name($name);
        $folder = $this->folder();
        $this->available($name);
        $this->guarded('write', $name, fn () => $this->available($name),
            fn () => $folder->newFile($name, $this->opml->create(substr($name, 0, -5))));
        return $this->open($name);
    }

    public function open(string $name): array
    {
        $file = $this->file($name);
        $file->lock(ILockingProvider::LOCK_SHARED);
        try {
            $result = ['name' => $name, 'etag' => $file->getEtag(), 'document' => $this->opml->read($file->getContent())];
            $this->remember($name);
            return $result;
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
        $stem = substr(basename($name), 0, -5);
        do {
            $copyName = mb_strcut($stem, 0, 190, 'UTF-8') . ' (copy ' . bin2hex(random_bytes(6)) . ').opml';
        } while ($folder->nodeExists($copyName));
        $this->guarded('write', $copyName, fn () => $this->available($copyName), fn () => $folder->newFile($copyName, $xml));
        return $this->open($copyName);
    }

    /** Paths and history are always relative to this session user's Outlines folder. */
    public function recent(): array
    {
        $user = $this->session->getUser();
        if (!$user) throw new RuntimeException('Sign in to open outlines.', 401);
        $stored = json_decode($this->config?->getUserValue($user->getUID(), 'outliner', 'recent', '[]') ?? '[]', true);
        if (!is_array($stored)) return [];
        $available = $this->listing();
        return array_slice(array_values(array_filter($stored, fn ($name) => is_string($name) && in_array($name, $available, true))), 0, 10);
    }

    private function remember(string $name, ?string $previous = null): void
    {
        if (!$this->config) return;
        $uid = $this->session->getUser()->getUID();
        $stored = json_decode($this->config->getUserValue($uid, 'outliner', 'recent', '[]'), true);
        $stored = is_array($stored) ? $stored : [];
        $recent = array_slice(array_values(array_unique([$name, ...array_filter($stored, fn ($entry) => is_string($entry) && $entry !== $previous)])), 0, 10);
        $this->config->setUserValue($uid, 'outliner', 'recent', json_encode($recent, JSON_THROW_ON_ERROR));
    }

    /** Relocation retains original XML exactly and never replaces another file. */
    public function relocate(string $name, string $destination, string $etag): array
    {
        $this->path($name);
        $this->path($destination);
        $this->unchanged($name, $etag);
        if ($name === $destination) return $this->open($name);
        $this->available($destination);
        $parent = $this->folder();
        $parts = explode('/', $destination);
        $filename = array_pop($parts);
        foreach ($parts as $part) {
            $parent = $parent->nodeExists($part) ? $parent->get($part) : $parent->newFolder($part);
            if (!$parent instanceof Folder) throw new InvalidArgumentException('Destination parent is not a folder.');
        }
        $this->guarded('rename', $name, function () use ($name, $destination, $etag): void {
            $this->unchanged($name, $etag);
            $this->available($destination);
        }, fn () => $this->file($name)->move($parent->getPath() . '/' . $filename));
        $this->remember($destination, $name);
        return $this->open($destination);
    }

    public function save(string $name, array $document, string $etag): array
    {
        $this->unchanged($name, $etag);
        $file = $this->file($name);
        $xml = $this->opml->write($document, $file->getContent());
        // Capture our ETag under View's post-write shared lock. A later writer
        // must never lend its ETag to the document still displayed in this tab.
        $savedEtag = $this->guarded('write', $name, fn () => $this->unchanged($name, $etag),
            fn () => $file->putContent($xml), fn () => $this->file($name)->getEtag());
        return ['name' => $name, 'etag' => $savedEtag];
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
}
