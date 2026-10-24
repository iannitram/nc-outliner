<?php
declare(strict_types=1);
namespace OCP { interface IUserSession { public function getUser(); } }
namespace OCP\Lock { interface ILockingProvider { public const LOCK_SHARED = 1; public const LOCK_EXCLUSIVE = 2; } }
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
        public function __construct(public string $name = '') {}
        public function getName(): string { return $this->name; }
        public function nodeExists(string $name): bool { return isset($this->nodes[$name]); }
        public function get(string $name) { return $this->nodes[$name] ?? throw new NotFoundException(); }
        public function newFolder(string $name): Folder { return $this->nodes[$name] = new Folder($name); }
        public function newFile(string $name, string $content): File {
            if ($this->locks < 1) throw new \RuntimeException('Creation must hold folder lock');
            return $this->nodes[$name] = new File($name, $content);
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
    public function getUserFolder(string $uid): Folder { return $this->homes[$uid] ??= new Folder(); }
};
$session = new class implements \OCP\IUserSession {
    public ?string $uid = 'alice';
    public function getUser() { return $this->uid === null ? null : new class($this->uid) {
        public function __construct(private string $uid) {}
        public function getUID(): string { return $this->uid; }
    }; }
};
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
}
