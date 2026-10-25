<?php
declare(strict_types=1);
define('OC_CONSOLE', true);
require '/var/www/html/lib/base.php';
set_exception_handler(function (Throwable $e): void {
    fwrite(STDERR, get_class($e) . ': ' . $e->getMessage() . PHP_EOL . $e->getTraceAsString() . PHP_EOL);
    exit(1);
});
$uid = $argv[1] ?? throw new InvalidArgumentException('Pass a disposable Nextcloud user ID.');
$user = \OCP\Server::get(\OCP\IUserManager::class)->get($uid);
$session = \OCP\Server::get(\OCP\IUserSession::class);
$session->setUser($user);
\OC\Files\Filesystem::init($uid, '/' . $uid . '/files');
\OC_App::loadApp('outliner');
$root = \OCP\Server::get(\OCP\Files\IRootFolder::class);
$files = new \OCA\Outliner\Service\OutlineFiles(
    $root,
    $session,
    new \OCA\Outliner\Service\Opml(),
    \OCP\Server::get(\OCP\IConfig::class),
);
$prefix = 'Template ' . bin2hex(random_bytes(5));
function verify(bool $condition, string $message): void { if (!$condition) throw new RuntimeException($message); }
function expectStatus(callable $action, int $status): void {
    try { $action(); throw new LogicException('Accepted a colliding template write'); }
    catch (RuntimeException $error) { verify($error->getCode() === $status, $error->getMessage() . ': expected ' . $status); }
}
$outlines = $root->getUserFolder($uid)->nodeExists('Outlines')
    ? $root->getUserFolder($uid)->get('Outlines')
    : $root->getUserFolder($uid)->newFolder('Outlines');
$templates = $outlines->nodeExists('Templates') ? $outlines->get('Templates') : $outlines->newFolder('Templates');
$opml = new \OCA\Outliner\Service\Opml();
$sourceName = $prefix . ' source.opml';
$sourceXml = $opml->create('Source');
$outlines->newFile($sourceName, $sourceXml);
$source = $files->open($sourceName);
$snapshot = [
    'title' => 'Unsaved snapshot',
    'rows' => [['id' => 'template-row', 'text' => 'Unsaved topic', 'children' => []]],
];
$templateName = $prefix . '.opml';
$files->saveTemplate($templateName, $sourceName, $source['etag'], $snapshot);
verify($files->templates() !== [], 'Template missing from listing');
verify($files->open($sourceName)['document'] === $source['document'], 'Saving template modified the source outline');
$templatePath = $templates->get($templateName);
$templateBytes = $templatePath->getContent();
$new = $files->fromTemplate($templateName, $prefix . ' new.opml');
verify($new['document']['title'] === $prefix . ' new', 'New outline title did not use its filename');
verify($new['document']['rows'][0]['text'] === 'Unsaved topic', 'Unsaved template content was lost');
verify($templatePath->getContent() === $templateBytes, 'Starting an outline modified the template');

// Race a different writer into the native preWrite window. The template API's
// cancellable NC33 write hook must detect it without replacing the winner.
$target = $prefix . ' raced.opml';
$winnerXml = $opml->create('Winner');
$once = true;
$listener = function ($node) use (&$once, $templates, $target, $winnerXml): void {
    if (!$once || $node->getPath() !== $templates->getPath() . '/' . $target) return;
    $once = false;
    $templates->newFile($target, $winnerXml);
};
$root->listen('\\OC\\Files', 'preWrite', $listener);
expectStatus(fn () => $files->saveTemplate($target, $sourceName, $source['etag'], $snapshot), 409);
$root->removeListener('\\OC\\Files', 'preWrite', $listener);
verify(!$once, 'Native preWrite collision was not injected');
verify($templates->get($target)->getContent() === $winnerXml, 'Template collision replaced existing Files data');
echo "PASS Nextcloud 33 template APIs: saves unsaved snapshot in user Files, copies to a distinct outline, preserves template/source and rejects native write collision\n";
