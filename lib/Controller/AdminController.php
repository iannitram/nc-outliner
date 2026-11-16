<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\RedirectResponse;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IURLGenerator;

final class AdminController extends Controller {
	public function __construct(IRequest $request, private readonly IAppConfig $config, private readonly IURLGenerator $urlGenerator) {
		parent::__construct(Application::APP_ID, $request);
	}

	public function save(string $bug_drop_base = '', string $bug_drop_token = '', bool $clearToken = false): RedirectResponse {
		$this->config->setValueString(Application::APP_ID, 'bug_drop_base', trim($bug_drop_base));
		// A blank password keeps the existing secret; clearing it is explicit.
		if ($clearToken || $bug_drop_token !== '') {
			$this->config->setValueString(Application::APP_ID, 'bug_drop_token', $clearToken ? '' : $bug_drop_token, false, true);
		}
		return new RedirectResponse($this->urlGenerator->linkToRoute('settings.AdminSettings.index', ['section' => Application::APP_ID]));
	}
}
