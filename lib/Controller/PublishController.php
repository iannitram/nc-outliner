<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCA\NcOutliner\Service\NotFoundException;
use OCA\NcOutliner\Service\PublishService;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Files\NotFoundException as FilesNotFoundException;
use OCP\Files\NotPermittedException;
use OCP\Files\StorageNotAvailableException;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUserSession;
use OCP\Lock\LockedException;

final class PublishController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly PublishService $publishService,
		private readonly IUserSession $userSession,
		private readonly IURLGenerator $urlGenerator,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	public function publish(int $fileId, string $folder = '', string $name = ''): JSONResponse {
		try {
			$result = $this->publishService->publish($this->userSession->getUser()->getUID(), $fileId, $folder, $name);
			return new JSONResponse($result + ['openUrl' => $this->urlGenerator->linkToRoute('files.view.index', [
				'openfile' => 'true',
				'fileid' => $result['fileId'],
			])]);
		} catch (NotFoundException) {
			return new JSONResponse([], Http::STATUS_NOT_FOUND);
		} catch (\InvalidArgumentException $e) {
			return new JSONResponse(['message' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
		} catch (FilesNotFoundException) {
			return new JSONResponse(['message' => 'Destination folder does not exist'], Http::STATUS_BAD_REQUEST);
		} catch (NotPermittedException | StorageNotAvailableException | LockedException) {
			return new JSONResponse(['message' => 'Cannot save the document in this folder. It may be read-only.'], Http::STATUS_FORBIDDEN);
		}
	}
}
