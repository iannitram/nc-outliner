<?php
declare(strict_types=1);

namespace OCA\Outliner\Service;

use OCA\Outliner\AppInfo\Application;
use OCP\IConfig;
use OCP\IUserSession;

class ThemePreferences
{
    public function __construct(private IConfig $config, private IUserSession $session) {}

    private function uid(): string
    {
        $user = $this->session->getUser();
        if (!$user) {
            throw new \RuntimeException('Sign in to change appearance.', 401);
        }
        return $user->getUID();
    }

    public function get(): string
    {
        $theme = $this->config->getUserValue($this->uid(), Application::APP_ID, 'theme', 'auto');
        return in_array($theme, ['auto', 'light', 'dark'], true) ? $theme : 'auto';
    }

    public function set(string $theme): string
    {
        $uid = $this->uid();
        if (!in_array($theme, ['auto', 'light', 'dark'], true)) {
            throw new \InvalidArgumentException('Choose Auto, Light or Dark.');
        }
        $this->config->setUserValue($uid, Application::APP_ID, 'theme', $theme);
        return $theme;
    }
}
