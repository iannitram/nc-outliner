<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\IAppConfig;
use OCP\App\IAppManager;
use OCP\AppFramework\Services\IInitialState;
use OCP\ServerVersion;

class PageController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IInitialState $initialState,
		private readonly IAppManager $appManager,
		private readonly IAppConfig $appConfig,
		private readonly ServerVersion $serverVersion,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		$metadataFile = __DIR__ . '/../../appinfo/build.json';
		$metadata = is_file($metadataFile) ? json_decode(file_get_contents($metadataFile), true) : [];
		$this->initialState->provideInitialState('bugReport', [
			'version' => $this->appManager->getAppVersion(Application::APP_ID),
			'commit' => $metadata['commit'] ?? 'unknown',
			'ncVersion' => $this->serverVersion->getVersionString(),
			'configured' => $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_base') !== ''
				&& $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_token') !== '',
		]);
		return new TemplateResponse(Application::APP_ID, 'main');
	}
}
