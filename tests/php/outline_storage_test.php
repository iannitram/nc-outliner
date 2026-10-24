<?php
declare(strict_types=1);
require __DIR__ . '/assert.php';
require __DIR__ . '/ocp_stubs.php';
require __DIR__ . '/../../lib/AppInfo/Application.php';
require __DIR__ . '/../../lib/Service/OutlineName.php';
require __DIR__ . '/../../lib/Service/OutlineStorage.php';
require __DIR__ . '/../../lib/Controller/OutlineController.php';

class FakeFile implements \OCP\Files\File { private int $version = 1; public function __construct(private string $name, private string $content, private int $mtime = 0) {} public function getName(): string { return $this->name; } public function getMTime(): int { return $this->mtime; } public function getSize(): int|float { return strlen($this->content); } public function getEtag(): string { return 'e' . $this->version; } public function getContent(): string { return $this->content; } public function write(string $content): void { $this->content = $content; $this->version++; } public function setMTime(int $mtime): void { $this->mtime = $mtime; } }
class FakeDir implements \OCP\Files\Folder { private array $children = []; public function __construct(private string $name, private int $mtime = 0) {} public function getName(): string { return $this->name; } public function getMTime(): int { return $this->mtime; } public function getSize(): int|float { return 0; } public function getEtag(): string { return 'd1'; } public function getDirectoryListing(): array { return array_values($this->children); } public function get(string $path): \OCP\Files\Node { if (!$this->nodeExists($path)) throw new \OCP\Files\NotFoundException(); return $this->children[$path]; } public function nodeExists(string $path): bool { return isset($this->children[$path]); } public function newFile(string $path, ?string $content = null): \OCP\Files\File { if (isset($this->children[$path])) { $this->children[$path]->write($content ?? ''); return $this->children[$path]; } return $this->children[$path] = new FakeFile($path, $content ?? ''); } public function newFolder(string $path): \OCP\Files\Folder { return $this->children[$path] = new FakeDir($path); } public function setMTime(string $path, int $mtime): void { $this->children[$path]->setMTime($mtime); } }
class FakeRoot implements \OCP\Files\IRootFolder { private array $users = []; public function getUserFolder(string $userId): \OCP\Files\Folder { return $this->users[$userId] ??= new FakeDir($userId); } }

function seeded(FakeRoot $root): void { $d = $root->getUserFolder('alice')->newFolder('Outlines'); $d->newFile('a.opml', 'aa'); $d->setMTime('a.opml', 100); $d->newFile('B.OPML', 'bbbb'); $d->setMTime('B.OPML', 300); $d->newFile('c.txt', 'x'); $d->setMTime('c.txt', 500); $d->newFolder('x.opml'); }
function controller(FakeRoot $root): \OCA\Outliner\Controller\OutlineController { $session = new class implements \OCP\IUserSession { public function getUser(): ?\OCP\IUser { return new class implements \OCP\IUser { public function getUID(): string { return 'alice'; } }; } }; return new \OCA\Outliner\Controller\OutlineController(new class implements \OCP\IRequest {}, new \OCA\Outliner\Service\OutlineStorage($root), $session); }
use OCA\Outliner\Service\OutlineStorage; use OCA\Outliner\Controller\OutlineController;

check('create', function (): void { $s = new OutlineStorage(new FakeRoot); same(['name'=>'A.opml','etag'=>'e1'], $s->create('alice','A.opml','one')); });
check('duplicate create', function (): void { $s = new OutlineStorage(new FakeRoot); $s->create('alice','A.opml','one'); $threw = false; try { $s->create('alice','A.opml','two'); } catch (\OCP\Files\GenericFileException) { $threw = true; } same(true, $threw); same('one', $s->read('alice','A.opml')['content']); });
check('read', function (): void { $s = new OutlineStorage(new FakeRoot); $s->create('alice','A.opml','one'); same(['name'=>'A.opml','content'=>'one','etag'=>'e1'], $s->read('alice','A.opml')); });
check('missing read', function (): void { $threw=false; try { (new OutlineStorage(new FakeRoot))->read('alice','Z.opml'); } catch (\OCP\Files\NotFoundException) { $threw=true; } same(true,$threw); });
check('list filters and sorts', function (): void { $r=new FakeRoot; seeded($r); $s=new OutlineStorage($r); same([['name'=>'B.OPML','mtime'=>300,'size'=>4],['name'=>'a.opml','mtime'=>100,'size'=>2]],$s->list('alice')); });
check('folder read is missing', function (): void { $r=new FakeRoot; seeded($r); $threw=false; try {(new OutlineStorage($r))->read('alice','x.opml');} catch (\OCP\Files\NotFoundException) {$threw=true;} same(true,$threw); });
check('empty list', fn()=>same([], (new OutlineStorage(new FakeRoot))->list('alice')));
check('controller create', function (): void { $r=new FakeRoot; $x=controller($r)->create('Plan','<opml/>'); same(201,$x->getStatus()); same(['name'=>'Plan.opml','etag'=>'e1'],$x->getData()); });
check('controller duplicate', function (): void { $r=new FakeRoot; $c=controller($r); $c->create('Plan','<opml/>'); $x=$c->create('Plan','<opml/>'); same(409,$x->getStatus()); same(['error'=>'exists'],$x->getData()); });
check('invalid content', fn()=>same(['error'=>'invalid content'], controller(new FakeRoot)->create('Plan',null)->getData()));
check('invalid missing name', fn()=>same(['error'=>'invalid name'], controller(new FakeRoot)->create(null,'x')->getData()));
check('controller folder show', function (): void { $r=new FakeRoot; seeded($r); $x=controller($r)->show('x.opml'); same(404,$x->getStatus()); same(['error'=>'not found'],$x->getData()); });
check('controller invalid show', fn()=>same(['error'=>'invalid name'], controller(new FakeRoot)->show('a/b')->getData()));
check('controller index', function (): void { $r=new FakeRoot; seeded($r); $x=controller($r)->index(); same(200,$x->getStatus()); same([['name'=>'B.OPML','mtime'=>300,'size'=>4],['name'=>'a.opml','mtime'=>100,'size'=>2]],$x->getData()); });
