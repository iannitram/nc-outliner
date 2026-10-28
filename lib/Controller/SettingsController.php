<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUserSession;

final class SettingsController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IConfig $config,
		private readonly IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	public function get(): JSONResponse {
		$user = $this->userSession->getUser();
		$theme = $this->config->getUserValue($user->getUID(), Application::APP_ID, 'theme', 'auto');
		if (!in_array($theme, ['auto', 'light', 'dark'], true)) {
			$theme = 'auto';
		}
		return new JSONResponse(['theme' => $theme], Http::STATUS_OK);
	}

	#[NoAdminRequired]
	public function set(string $theme): JSONResponse {
		if (!in_array($theme, ['auto', 'light', 'dark'], true)) {
			return new JSONResponse(['message' => 'theme must be auto, light or dark'], Http::STATUS_BAD_REQUEST);
		}

		$user = $this->userSession->getUser();
		$this->config->setUserValue($user->getUID(), Application::APP_ID, 'theme', $theme);
		return new JSONResponse(['theme' => $theme], Http::STATUS_OK);
	}
}
