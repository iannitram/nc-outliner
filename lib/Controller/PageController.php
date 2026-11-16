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
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

class PageController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IInitialState $initialState,
		private readonly IAppManager $appManager,
		private readonly IAppConfig $appConfig,
		private readonly ServerVersion $serverVersion,
		private readonly LoggerInterface $logger = new NullLogger(),
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/**
	 * The page's data attributes: crash_log (TEMPORARY, #177) and the versions the crash log sends.
	 */
	#[NoAdminRequired]
	#[NoCSRFRequired]
	public function index(): TemplateResponse {
		try {
			$appVersion = $this->appManager->getAppVersion(Application::APP_ID);
			$ncVersion = $this->serverVersion->getVersionString();
			$metadataFile = __DIR__ . '/../../appinfo/build.json';
			$metadata = is_file($metadataFile) ? json_decode(file_get_contents($metadataFile), true) : [];
			$this->initialState->provideInitialState('bugReport', [
				'version' => $appVersion,
				'commit' => $metadata['commit'] ?? 'unknown',
				'ncVersion' => $ncVersion,
				'configured' => $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_base') !== ''
					&& $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_token') !== '',
			]);
			return new TemplateResponse(Application::APP_ID, 'main', [
				'crashLog' => $this->appConfig->getValueString(Application::APP_ID, 'crash_log', '1'),
				'appVersion' => $appVersion,
				'ncVersion' => $ncVersion,
			]);
		} catch (\Throwable $e) {
			ClientLogController::reportServerException($this->logger, __METHOD__, $e);
			throw $e;
		}
	}
}
