<?php
declare(strict_types=1);
define('OC_CONSOLE', true);
require '/var/www/html/lib/base.php';
set_exception_handler(function (Throwable $e): void { fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . PHP_EOL . $e->getTraceAsString() . PHP_EOL); exit(1); });
$uid = $argv[1] ?? throw new InvalidArgumentException('Pass a disposable Nextcloud user ID.');
$user = \OCP\Server::get(\OCP\IUserManager::class)->get($uid);
$session = \OCP\Server::get(\OCP\IUserSession::class);
$session->setUser($user);
\OC\Files\Filesystem::init($uid, '/' . $uid . '/files');
\OC_App::loadApp('outliner');
$root = \OCP\Server::get(\OCP\Files\IRootFolder::class);
$files = new \OCA\Outliner\Service\OutlineFiles($root, $session, new \OCA\Outliner\Service\Opml(), \OCP\Server::get(\OCP\IConfig::class));
$prefix = 'Native ' . bin2hex(random_bytes(4));
function verify(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function status(callable $action, int $expected): void {
    try { $action(); throw new LogicException('Accepted unsafe operation'); }
    catch (RuntimeException $error) { verify($error->getCode() === $expected, $error->getMessage() . ': expected status ' . $expected); }
}
$files->listing(); // Ensure the disposable user's Outlines folder exists.
$folder = $root->getUserFolder($uid)->get('Outlines');
foreach (['save' => 'preWrite', 'move' => 'preRename'] as $action => $event) {
    $opened = $files->create($prefix . ' ' . $action . '.opml');
    $name = $opened['name'];
    $cached = $folder->get($name);
    $oldEtag = $cached->getEtag();
    $once = true;
    $xml = '<opml><head><title>Concurrent writer</title></head><body><outline text="Keep competitor"/></body></opml>';
    $listener = function ($node) use (&$once, $folder, $name, $xml): void {
        if (!$once || $node->getPath() !== $folder->getPath() . '/' . $name) return;
        $once = false;
        $folder->get($name)->putContent($xml);
        // Inject a changed cache ETag as an independent writer would publish.
        $fresh = $folder->get($name);
        $fresh->getStorage()->getCache()->update($fresh->getId(), ['etag' => 'concurrent-' . bin2hex(random_bytes(8))]);
    };
    $root->listen('\OC\Files', $event, $listener);
    status(fn () => $action === 'save' ? $files->save($name, $opened['document'], $opened['etag']) : $files->relocate($name, $prefix . ' forbidden.opml', $opened['etag']), 412);
    $root->removeListener('\OC\Files', $event, $listener);
    verify(!$once, 'Native early hook did not inject change');
    verify($folder->get($name)->getContent() === $xml, 'Concurrent data overwritten');
    verify($cached->getEtag() === $oldEtag, 'Fixture did not retain stale cached FileInfo');
    verify($folder->get($name)->getEtag() !== $oldEtag, 'Fresh node ETag did not change');
    verify(!$folder->nodeExists($prefix . ' forbidden.opml'), 'Moved racing source');
}
foreach (['create', 'move'] as $operation) {
    $source = $files->create($prefix . ' source ' . $operation . '.opml');
    $target = $prefix . ' collision ' . $operation . '.opml';
    $once = true;
    $xml = '<opml><head><title>Collision</title></head><body/></opml>';
    $event = $operation === 'create' ? 'preWrite' : 'preRename';
    $listener = function ($node) use (&$once, $operation, $folder, $target, $source, $xml): void {
        $expected = $operation === 'create' ? $target : $source['name'];
        if (!$once || $node->getPath() !== $folder->getPath() . '/' . $expected) return;
        $once = false;
        $folder->newFile($target, $xml);
    };
    $root->listen('\OC\Files', $event, $listener);
    status(fn () => $operation === 'create' ? $files->create($target) : $files->relocate($source['name'], $target, $source['etag']), 409);
    $root->removeListener('\OC\Files', $event, $listener);
    verify(!$once, 'Collision not injected');
    verify($folder->get($target)->getContent() === $xml, 'Collision target overwritten');
}
try { $files->relocate($source['name'], 'Hidden.part/Unsafe.opml', $source['etag']); throw new LogicException('Partial path accepted'); } catch (InvalidArgumentException) {}
echo "PASS native NC33 Files: cached stale ETag injection before save/move, 412 cancellation preserves bytes; create/move destination races return409 without replacement\n";
