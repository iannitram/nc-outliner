<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Settings;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IAppConfig;
use OCP\IURLGenerator;
use OCP\Settings\ISettings;

final class Admin implements ISettings {
	public function __construct(private readonly IAppConfig $config, private readonly IURLGenerator $urlGenerator) {
	}
	public function getForm(): TemplateResponse {
		return new TemplateResponse(Application::APP_ID, 'settings-admin', [
			'base' => $this->config->getValueString(Application::APP_ID, 'bug_drop_base'),
			'tokenSet' => $this->config->getValueString(Application::APP_ID, 'bug_drop_token') !== '',
			'action' => $this->urlGenerator->linkToRoute('nc_outliner.admin.save'),
		], '');
	}
	public function getSection(): string { return Application::APP_ID; }
	public function getPriority(): int { return 70; }
}
