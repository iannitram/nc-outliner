<?php
declare(strict_types=1);
namespace OCP {
    class Server { public static mixed $provider; public static function get(string $type): mixed { return self::$provider; } }
    class Util {
        public static array $hooks = [];
        public static mixed $before = null;
        public static mixed $after = null;
        public static function connectHook($scope, $event, $listener, $method): void { self::$hooks[$event][] = [$listener, $method]; }
        public static function emit(string $event, string $path, callable $action, ?string $destination = null): void {
            // Model View's SHARED lock, cancellable hooks, then exclusive upgrade.
            if (self::$before) { $before = self::$before; self::$before = null; $before(); }
            $run = true;
            $params = ['path' => $path, 'oldpath' => $path, 'newpath' => $destination, 'run' => &$run];
            foreach (self::$hooks[$event] ?? [] as $hook) {
                try { $hook($params); } catch (\Throwable) {} // OC_Hook swallows exceptions.
            }
            if ($run) {
                $action();
                foreach (self::$hooks['post_' . $event] ?? [] as $hook) { try { $hook($params); } catch (\Throwable) {} }
            }
        }
    }
    interface IConfig { public function getUserValue($uid, $app, $key, $default); public function setUserValue($uid, $app, $key, $value); } interface IUserSession { public function getUser(); } }
namespace OCP\Lock { interface ILockingProvider { public const LOCK_SHARED = 1; public const LOCK_EXCLUSIVE = 2; } }
namespace OC\Files { class Filesystem { public static bool $loaded = true; public static function getRoot(): string { return ''; } } }
namespace OC\Lock { class NoopLockingProvider implements \OCP\Lock\ILockingProvider {} }
namespace OCP\Files {
    interface IRootFolder { public function getUserFolder(string $uid); }
    class NotFoundException extends \RuntimeException {}
    class AlreadyExistsException extends \RuntimeException {}
    class File {
        public int $locks = 0;
        public function __construct(public string $name, public string $content = '', public string $etag = 'initial', public ?Folder $parent = null) {}
        public function getName(): string { return $this->name; }
        public function move(string $path): void {
            $parts = explode('/', $path);
            $name = array_pop($parts);
            $target = Folder::$root->get(implode('/', $parts));
            \OCP\Util::emit('rename', '/' . $this->parent->getPath() . '/' . $this->name, function () use ($name, $target): void {
                unset($this->parent->nodes[$this->name]);
                $this->name = $name;
                $this->parent = $target;
                $target->nodes[$name] = $this;
            }, '/' . $path);
        }
        public function getContent(): string { return $this->content; }
        public function putContent(string $content): void { \OCP\Util::emit('write', '/' . $this->parent->getPath() . '/' . $this->name, function () use ($content): void { $this->content = $content; $this->etag = hash('sha256', $content); }); if (\OCP\Util::$after) { $after = \OCP\Util::$after; \OCP\Util::$after = null; $after(); } }
        public function getEtag(): string { return $this->etag; }
        public function lock(int $type): void { $this->locks++; }
        public function unlock(int $type): void { $this->locks--; }
    }
    class Folder {
        public static Folder $root;
        public array $nodes = [];
        public int $locks = 0;
        public function __construct(public string $name = '', public ?Folder $parent = null) { if ($parent === null) self::$root = $this; }
        public function getName(): string { return $this->name; }
        public function getPath(): string { return $this->parent ? trim($this->parent->getPath() . '/' . $this->name, '/') : ''; }
        public function nodeExists(string $name): bool { try { $this->get($name); return true; } catch (NotFoundException) { return false; } }
        public function get(string $name) {
            if ($name === '') return $this;
            $parts = explode('/', $name, 2);
            $node = $this->nodes[$parts[0]] ?? throw new NotFoundException();
            return count($parts) === 1 ? $node : ($node instanceof Folder ? $node->get($parts[1]) : throw new NotFoundException());
        }
        public function newFolder(string $name): Folder { return $this->nodes[$name] = new Folder($name, $this); }
        public function newFile(string $name, string $content): File {
            \OCP\Util::emit('write', '/' . $this->getPath() . '/' . $name, function () use ($name, $content): void { $this->nodes[$name] = new File($name, $content, 'initial', $this); });
            return $this->nodes[$name] ?? throw new \RuntimeException('Creation cancelled');
        }
        public function getDirectoryListing(): array { return array_values($this->nodes); }
        public function lock(int $type): void { $this->locks++; }
        public function unlock(int $type): void { $this->locks--; }
    }
}
namespace {
require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/Opml.php';
require __DIR__ . '/../../lib/Service/OutlineFiles.php';
use OCA\Outliner\Service\OutlineFiles;
use OCA\Outliner\Service\Opml;
use OCP\Files\File;
use OCP\Files\Folder;
$root = new class implements \OCP\Files\IRootFolder {
    public array $homes = [];
    public function getUserFolder(string $uid): Folder { return Folder::$root = ($this->homes[$uid] ??= new Folder()); }
};
$session = new class implements \OCP\IUserSession {
    public ?string $uid = 'alice';
    public function getUser() { return $this->uid === null ? null : new class($this->uid) {
        public function __construct(private string $uid) {}
        public function getUID(): string { return $this->uid; }
    }; }
};
$config = new class implements \OCP\IConfig {
    public array $values = [];
    public function getUserValue($uid, $app, $key, $default) { return $this->values[$uid][$key] ?? $default; }
    public function setUserValue($uid, $app, $key, $value) { $this->values[$uid][$key] = $value; }
};
\OCP\Server::$provider = new class implements \OCP\Lock\ILockingProvider {};
$files = new OutlineFiles($root, $session, new Opml(), $config);
check('first use creates own Outlines folder', function () use ($files, $root): void {
    same([], $files->listing());
    same(true, $root->homes['alice']->nodeExists('Outlines'));
});
check('create, list and open an outline', function () use ($files): void {
    $result = $files->create('Plan.opml');
    same('Plan', $result['document']['title']);
    same(['Plan.opml'], $files->listing());
    same($result, $files->open('Plan.opml'));
});
check('duplicate creation cannot overwrite existing data', function () use ($files, $root): void {
    try { $files->create('Plan.opml'); throw new \LogicException('Duplicate accepted'); }
    catch (\RuntimeException $e) { same(409, $e->getCode()); }
    same('Plan', $files->open('Plan.opml')['document']['title']);
    same(0, $root->homes['alice']->get('Outlines')->locks);
});
check('listing excludes folders and non-OPML files', function () use ($files, $root): void {
    $folder = $root->homes['alice']->get('Outlines');
    $folder->nodes['fake.opml'] = new Folder('fake.opml');
    $folder->nodes['notes.txt'] = new File('notes.txt');
    same(['Plan.opml'], $files->listing());
    try { $files->open('fake.opml'); throw new \LogicException('Folder opened'); }
    catch (\InvalidArgumentException) {}
});
check('traversal and invalid names cannot access other Files', function () use ($files): void {
    foreach (['../secret.opml', '/secret.opml', 'a\\b.opml', '.hidden.opml', "a\0.opml", 'x.txt', ''] as $name) {
        try { $files->create($name); throw new \LogicException('Invalid name accepted'); }
        catch (\InvalidArgumentException) {}
    }
});
check('saving checks etag and releases locks after conflicts', function () use ($files, $root): void {
    $opened = $files->open('Plan.opml');
    $document = $opened['document'];
    $document['title'] = 'Updated';
    $result = $files->save('Plan.opml', $document, $opened['etag']);
    same('Updated', $files->open('Plan.opml')['document']['title']);
    same(false, $result['etag'] === $opened['etag']);
    try { $files->save('Plan.opml', $opened['document'], $opened['etag']); throw new \LogicException('Stale write accepted'); }
    catch (\RuntimeException $e) { same(412, $e->getCode()); }
    same('Updated', $files->open('Plan.opml')['document']['title']);
    same(0, $root->homes['alice']->get('Outlines')->get('Plan.opml')->locks);
});
check('export includes unsaved edits and unknown XML without changing the original file', function () use ($files, $root): void {
    $file = $root->homes['alice']->get('Outlines')->get('Plan.opml');
    $original = $file->content;
    $etag = $file->etag;
    $file->content = '<opml xmlns:x="urn:custom"><head><title>Original</title><x:columns>schema</x:columns></head><body><outline text="Old" custom="kept"/></body></opml>';
    $document = $files->open('Plan.opml')['document'];
    $document['rows'][0]['text'] = 'Unsaved & <safe>';
    $export = $files->export('Plan.opml', $document)['content'];
    same(true, str_contains($export, '<x:columns>schema</x:columns>'));
    same(true, str_contains($export, 'custom="kept"'));
    same('Unsaved & <safe>', (new Opml())->read($export)['rows'][0]['text']);
    same('Old', $files->open('Plan.opml')['document']['rows'][0]['text']);
    same($etag, $file->etag);
    same(0, $file->locks);
    try { $files->export('Plan.opml', []); throw new \LogicException('Invalid export accepted'); }
    catch (\InvalidArgumentException) {}
    same(0, $file->locks);
    $file->content = $original;
});
check('same filename in another user home is isolated', function () use ($files, $session): void {
    $session->uid = 'bob';
    same([], $files->listing());
    $files->create('Plan.opml');
    same('Plan', $files->open('Plan.opml')['document']['title']);
    $session->uid = 'alice';
    same('Updated', $files->open('Plan.opml')['document']['title']);
});
check('anonymous requests never get a home folder', function () use ($files, $session): void {
    $session->uid = null;
    try { $files->listing(); throw new \LogicException('Anonymous accepted'); }
    catch (\RuntimeException $e) { same(401, $e->getCode()); }
    $session->uid = 'alice';
});
check('keeping a local copy preserves the conflicting original and creates distinct names', function () use ($files): void {
    $original = $files->open('Plan.opml');
    $local = $original['document'];
    $local['title'] = 'Local rewrite';
    $first = $files->keepCopy('Plan.opml', $local);
    $second = $files->keepCopy('Plan.opml', $local);
    same('Local rewrite', $first['document']['title']);
    same(false, $first['name'] === $second['name']);
    same($original, $files->open('Plan.opml'));
});

check('rename and nested move preserve exact XML and return usable etags', function () use ($files, $root): void {
    $opened = $files->create('To move.opml');
    $source = $root->homes['alice']->get('Outlines/To move.opml');
    $source->content = '<opml xmlns:x="urn:custom"><head><title>Metadata</title><x:columns>kept</x:columns></head><body><outline text="Topic" custom="preserved"/></body></opml>';
    $original = $source->content;
    $renamed = $files->relocate('To move.opml', 'Renamed.opml', $opened['etag']);
    same('Renamed.opml', $renamed['name']);
    $moved = $files->relocate('Renamed.opml', 'School/Term/Plan.opml', $renamed['etag']);
    same($original, $root->homes['alice']->get('Outlines/School/Term/Plan.opml')->content);
    same(true, in_array('School/Term/Plan.opml', $files->listing(), true));
    same(false, in_array('Renamed.opml', $files->listing(), true));
    same('School/Term/Plan.opml', $files->recent()[0]);
    same(false, in_array('Renamed.opml', $files->recent(), true));
    same('Metadata', $moved['document']['title']);
    $files->save($moved['name'], $moved['document'], $moved['etag']);
    same(0, $source->locks);
});
check('relocation rejects overwrite stale etags traversal and nonfolders', function () use ($files, $root): void {
    $opened = $files->create('Guarded.opml');
    foreach ([['Plan.opml', $opened['etag'], 409], ['Moved.opml', 'stale', 412]] as [$destination, $etag, $status]) {
        try { $files->relocate('Guarded.opml', $destination, $etag); throw new \LogicException('Unsafe relocation accepted'); }
        catch (\RuntimeException $e) { same($status, $e->getCode()); }
    }
    foreach (['../Outside.opml', '/Outside.opml', 'A/../Outside.opml', 'A\\B.opml', 'notes.txt/X.opml', 'Archive.part/Plan.opml'] as $destination) {
        try { $files->relocate('Guarded.opml', $destination, $opened['etag']); throw new \LogicException('Unsafe path accepted'); }
        catch (\InvalidArgumentException) {}
    }
    same($opened, $files->open('Guarded.opml'));
    same(0, $root->homes['alice']->get('Outlines')->locks);
    same(0, $root->homes['alice']->get('Outlines/Guarded.opml')->locks);
});
check('recents persist per user and ignore stale paths', function () use ($files, $session, $config): void {
    $session->uid = 'bob';
    same(['Plan.opml'], $files->recent());
    $session->uid = 'alice';
    $config->values['alice']['recent'] = json_encode(['missing.opml', 'Guarded.opml']);
    same(['Guarded.opml'], $files->recent());
    $files->open('School/Term/Plan.opml');
    same('School/Term/Plan.opml', $files->recent()[0]);
});

check('a writer arriving after the initial ETag check cannot be overwritten or relocated', function () use ($files, $root): void {
    foreach (['save', 'move'] as $operation) {
        $opened = $files->create('Race ' . $operation . '.opml');
        $node = $root->homes['alice']->get('Outlines/' . $opened['name']);
        \OCP\Util::$before = function () use ($node): void { $node->content = 'concurrent writer'; $node->etag = 'concurrent'; };
        try {
            if ($operation === 'save') $files->save($opened['name'], $opened['document'], $opened['etag']);
            else $files->relocate($opened['name'], 'Unsafe.opml', $opened['etag']);
            throw new \LogicException('Racing writer overwritten');
        } catch (\RuntimeException $e) { same(412, $e->getCode()); }
        same('concurrent writer', $node->content);
        same(true, $root->homes['alice']->nodeExists('Outlines/' . $opened['name']));
        same(false, $root->homes['alice']->nodeExists('Outlines/Unsafe.opml'));
    }
});
check('a destination appearing after the initial check cannot be replaced', function () use ($files, $root): void {
    $opened = $files->create('Collision source.opml');
    $folder = $root->homes['alice']->get('Outlines');
    \OCP\Util::$before = function () use ($folder): void { $folder->nodes['Collision.opml'] = new File('Collision.opml', 'other data', 'other', $folder); };
    try { $files->relocate($opened['name'], 'Collision.opml', $opened['etag']); throw new \LogicException('Racing destination overwritten'); }
    catch (\RuntimeException $e) { same(409, $e->getCode()); }
    same('other data', $folder->get('Collision.opml')->content);
    same($opened, $files->open($opened['name']));
});
check('creation rechecks availability at the native lock boundary', function () use ($files, $root): void {
    $folder = $root->homes['alice']->get('Outlines');
    \OCP\Util::$before = function () use ($folder): void { $folder->nodes['Create race.opml'] = new File('Create race.opml', 'keep', 'other', $folder); };
    try { $files->create('Create race.opml'); throw new \LogicException('Racing creation overwritten'); }
    catch (\RuntimeException $e) { same(409, $e->getCode()); }
    same('keep', $folder->get('Create race.opml')->content);
});
check('missing hook context or disabled locking refuses mutation before writing', function () use ($files): void {
    $provider = \OCP\Server::$provider;
    foreach (['context', 'locking'] as $missing) {
        \OC\Files\Filesystem::$loaded = $missing !== 'context';
        \OCP\Server::$provider = $missing === 'locking' ? new \OC\Lock\NoopLockingProvider() : $provider;
        try { $files->create('Unavailable.opml'); throw new \LogicException('Unsafe creation accepted'); }
        catch (\RuntimeException $e) { same(true, str_contains($e->getMessage(), 'Safe file updates')); }
        same(false, in_array('Unavailable.opml', $files->listing(), true));
    }
    \OC\Files\Filesystem::$loaded = true;
    \OCP\Server::$provider = $provider;
});

check('save response retains its own ETag if another writer commits after native unlock', function () use ($files, $root): void {
    $opened = $files->create('Response race.opml');
    $node = $root->homes['alice']->get('Outlines/Response race.opml');
    \OCP\Util::$after = function () use ($node): void { $node->content = 'unseen external data'; $node->etag = 'external-after-save'; };
    $saved = $files->save($opened['name'], $opened['document'], $opened['etag']);
    same(false, $saved['etag'] === 'external-after-save');
    try { $files->save($opened['name'], $opened['document'], $saved['etag']); throw new \LogicException('Unseen change overwritten'); }
    catch (\RuntimeException $e) { same(412, $e->getCode()); }
    same('unseen external data', $node->content);
});

}
