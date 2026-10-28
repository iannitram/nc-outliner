<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCA\NcOutliner\Service\PublishService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;
use OCP\IUserSession;

final class PublishController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly PublishService $publishService,
		private readonly IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	public function publish(int $fileId): JSONResponse {
		$params = $this->request->getParams();
		$folder = $params['folder'] ?? null;
		$name = $params['name'] ?? null;
		if (!is_string($folder) || !is_string($name)) {
			return new JSONResponse(['message' => 'folder and name are required'], Http::STATUS_BAD_REQUEST);
		}
		try {
			return new JSONResponse($this->publishService->publish(
				$this->userSession->getUser()->getUID(),
				$fileId,
				$folder,
				$name,
			), Http::STATUS_OK);
		} catch (\InvalidArgumentException $e) {
			return new JSONResponse(['message' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
		}
	}
}
