<?php
declare(strict_types=1);
namespace OCP {
    interface IUserSession { public function getUser(); }
    class Server { public static mixed $provider; public static function get(string $type): mixed { return self::$provider; } }
    class Util {
        public static array $hooks = [];
        public static mixed $before = null;
        public static function connectHook($scope, $event, $listener, $method): void { self::$hooks[$event][] = [$listener, $method]; }
        public static function emitWrite(string $path, callable $action): mixed {
            if (self::$before) { $before = self::$before; self::$before = null; $before(); }
            $run = true; $params = ['path' => $path, 'run' => &$run];
            foreach (self::$hooks['write'] ?? [] as [$listener, $method]) { try { $listener->$method($params); } catch (\Throwable) {} }
            if (!$run) return null;
            return $action();
        }
    }
}
namespace OCP\Lock { interface ILockingProvider { public const LOCK_SHARED = 1; public const LOCK_EXCLUSIVE = 2; } }
namespace OC\Files { class Filesystem { public static bool $loaded = true; public static function getRoot(): string { return '/home/alice'; } } }
namespace OC\Lock { class NoopLockingProvider implements \OCP\Lock\ILockingProvider {} }
namespace OCP\Files {
    interface IRootFolder { public function getUserFolder(string $uid); }
    class NotFoundException extends \RuntimeException {}
    class AlreadyExistsException extends \RuntimeException {}
    class File {
        public int $locks = 0;
        public function __construct(public string $name, public string $content = '', public string $etag = 'initial') {}
        public function getName(): string { return $this->name; }
        public function getContent(): string { return $this->content; }
        public function putContent(string $content): void { $this->content = $content; $this->etag = hash('sha256', $content); }
        public function getEtag(): string { return $this->etag; }
        public function lock(int $type): void { $this->locks++; }
        public function unlock(int $type): void { $this->locks--; }
    }
    class Folder {
        public array $nodes = [];
        public int $locks = 0;
        public function __construct(public string $name = '', public ?Folder $parent = null) {}
        public function getName(): string { return $this->name; }
        public function getPath(): string { return $this->parent ? rtrim($this->parent->getPath(), '/') . '/' . $this->name : $this->name; }
        public function nodeExists(string $name): bool { return isset($this->nodes[$name]); }
        public function get(string $name) { return $this->nodes[$name] ?? throw new NotFoundException(); }
        public function newFolder(string $name): Folder { return $this->nodes[$name] = new Folder($name, $this); }
        public function newFile(string $name, string $content): File {
            return \OCP\Util::emitWrite($this->name === 'Templates' ? '/Outlines/Templates/' . $name : '/Outlines/' . $name,
                function () use ($name, $content): File { return $this->nodes[$name] = new File($name, $content); })
                ?? throw new \RuntimeException('Native write cancelled.');
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
    public function getUserFolder(string $uid): Folder { return $this->homes[$uid] ??= new Folder('/home/' . $uid); }
};
$session = new class implements \OCP\IUserSession {
    public ?string $uid = 'alice';
    public function getUser() { return $this->uid === null ? null : new class($this->uid) {
        public function __construct(private string $uid) {}
        public function getUID(): string { return $this->uid; }
    }; }
};
\OCP\Server::$provider = new class implements \OCP\Lock\ILockingProvider {};
$files = new OutlineFiles($root, $session, new Opml());
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

check('saving an unsaved snapshot as a template and starting a new outline leaves both originals intact', function () use ($files, $root): void {
    $source = $files->create('Current.opml');
    $document = $source['document'];
    $document['title'] = 'Unsaved meeting';
    $document['rows'] = [['id' => 'draft-topic', 'text' => 'Draft topic', 'children' => []]];
    $saved = $files->saveTemplate('Meeting.opml', 'Current.opml', $source['etag'], $document);
    same('Meeting.opml', $saved['name']);
    same(['Meeting.opml'], $files->templates());
    same('Current', $files->open('Current.opml')['document']['title']);
    $templatePath = $root->homes['alice']->get('Outlines')->get('Templates')->get('Meeting.opml');
    same('Draft topic', (new Opml())->read($templatePath->content)['rows'][0]['text']);
    $new = $files->fromTemplate('Meeting.opml', 'Week 12.opml');
    same('Week 12', $new['document']['title']);
    same('Draft topic', $new['document']['rows'][0]['text']);
    same('Unsaved meeting', (new Opml())->read($templatePath->content)['title']);
    same('Current', $files->open('Current.opml')['document']['title']);
});

check('template collisions and stale source ETags never replace user files', function () use ($files, $root): void {
    $source = $files->create('Collision source.opml');
    $first = $files->saveTemplate('Unique.opml', 'Collision source.opml', $source['etag'], $source['document']);
    try { $files->saveTemplate('Unique.opml', 'Collision source.opml', $source['etag'], $source['document']); throw new \LogicException('Template collision accepted'); }
    catch (\RuntimeException $e) { same(409, $e->getCode()); }
    try { $files->fromTemplate('Unique.opml', 'Collision source.opml'); throw new \LogicException('Outline collision accepted'); }
    catch (\RuntimeException $e) { same(409, $e->getCode()); }
    same($first['document'], $files->open('Collision source.opml')['document']);
    $edited = $source['document']; $edited['title'] = 'Stale';
    try { $files->saveTemplate('Stale.opml', 'Collision source.opml', 'old-etag', $edited); throw new \LogicException('Stale template source accepted'); }
    catch (\RuntimeException $e) { same(412, $e->getCode()); }
    same(false, $root->homes['alice']->get('Outlines')->get('Templates')->nodeExists('Stale.opml'));
    same(0, $root->homes['alice']->get('Outlines')->get('Templates')->locks);
});

check('native write collision guard cancels a template create without replacing data', function () use ($files, $root): void {
    $folder = $root->homes['alice']->get('Outlines')->get('Templates');
    // Inject the collision at the exact write-hook boundary, where NC33 has
    // already acquired its native shared lock and is about to upgrade it.
    \OCP\Util::$before = function () use ($folder): void { $folder->nodes['Raced.opml'] = new File('Raced.opml', 'winner'); };
    try { $files->saveTemplate('Raced.opml', 'Current.opml', $files->open('Current.opml')['etag'], $files->open('Current.opml')['document']); throw new \LogicException('Racing collision accepted'); }
    catch (\RuntimeException $e) { same(409, $e->getCode()); }
    same('winner', $folder->get('Raced.opml')->getContent());
});

}
