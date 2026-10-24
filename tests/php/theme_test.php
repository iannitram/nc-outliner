<?php
declare(strict_types=1);
namespace OCP {
    interface IConfig { public function getUserValue(string $uid, string $app, string $key, string $default); public function setUserValue(string $uid, string $app, string $key, string $value); }
    interface IUserSession { public function getUser(); }
}
namespace OCA\Outliner\AppInfo { class Application { public const APP_ID = 'outliner'; } }
namespace {
require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/ThemePreferences.php';
use OCA\Outliner\Service\ThemePreferences;
$config = new class implements \OCP\IConfig {
    public array $values = [];
    public function getUserValue(string $uid, string $app, string $key, string $default) { return $this->values[$uid][$app][$key] ?? $default; }
    public function setUserValue(string $uid, string $app, string $key, string $value) { $this->values[$uid][$app][$key] = $value; }
};
$session = new class implements \OCP\IUserSession {
    public ?string $uid = 'alice';
    public function getUser() { return $this->uid === null ? null : new class($this->uid) {
        public function __construct(private string $uid) {}
        public function getUID(): string { return $this->uid; }
    }; }
};
$preferences = new ThemePreferences($config, $session);
check('theme defaults to Auto', function () use ($preferences): void { same('auto', $preferences->get()); });
check('all supported theme values persist for signed-in user', function () use ($preferences): void {
    foreach (['light', 'dark', 'auto'] as $theme) { same($theme, $preferences->set($theme)); same($theme, $preferences->get()); }
});
check('theme preferences are isolated between accounts', function () use ($preferences, $session): void {
    $preferences->set('dark'); $session->uid = 'bob'; same('auto', $preferences->get());
    $preferences->set('light'); $session->uid = 'alice'; same('dark', $preferences->get());
});
check('invalid preference does not overwrite saved value', function () use ($preferences): void {
    try { $preferences->set('invalid'); throw new \LogicException('Invalid theme accepted'); } catch (\InvalidArgumentException) {}
    same('dark', $preferences->get());
});
check('unknown stored values safely fall back to Auto', function () use ($preferences, $config): void {
    $config->values['alice']['outliner']['theme'] = 'invalid'; same('auto', $preferences->get());
});
check('anonymous reads and writes never access another account preference', function () use ($preferences, $session, $config): void {
    $before = $config->values; $session->uid = null;
    foreach ([fn () => $preferences->get(), fn () => $preferences->set('light')] as $action) {
        try { $action(); throw new \LogicException('Anonymous accepted'); } catch (\RuntimeException $e) { same(401, $e->getCode()); }
    }
    same($before, $config->values);
});
}
