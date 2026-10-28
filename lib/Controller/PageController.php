<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\App\IAppManager;
use OCP\IAppConfig;
use OCP\IConfig;
use OCP\IRequest;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

class PageController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IAppConfig $appConfig,
		private readonly IAppManager $appManager,
		private readonly IConfig $config,
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
			return new TemplateResponse(Application::APP_ID, 'main', [
				'crashLog' => $this->appConfig->getValueString(Application::APP_ID, 'crash_log', '1'),
				'appVersion' => $this->appManager->getAppVersion(Application::APP_ID),
				'ncVersion' => $this->config->getSystemValueString('version', ''),
			]);
		} catch (\Throwable $e) {
			ClientLogController::reportServerException($this->logger, __METHOD__, $e);
			throw $e;
		}
	}
}
