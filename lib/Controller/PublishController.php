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
use OCP\Files\StorageInvalidException;
use OCP\Files\StorageNotAvailableException;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUserSession;
use OCP\Lock\LockedException;
use Psr\Log\LoggerInterface;
use Psr\Log\NullLogger;

final class PublishController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly PublishService $publishService,
		private readonly IUserSession $userSession,
		private readonly IURLGenerator $urlGenerator,
		private readonly LoggerInterface $logger = new NullLogger(),
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	public function publish(int $fileId, string $folder = '', string $name = ''): JSONResponse {
		try {
			$result = $this->publishService->publish($this->userSession->getUser()->getUID(), $fileId, $folder, $name);
			return new JSONResponse($result + ['openUrl' => $this->urlGenerator->linkToRoute('files.View.showFile', [
				'fileid' => $result['fileId'],
			])]);
		} catch (NotFoundException) {
			return new JSONResponse([], Http::STATUS_NOT_FOUND);
		} catch (\InvalidArgumentException $e) {
			return new JSONResponse(['message' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
		} catch (FilesNotFoundException) {
			return new JSONResponse(['message' => 'Destination folder does not exist'], Http::STATUS_BAD_REQUEST);
		} catch (LockedException) {
			return new JSONResponse(['message' => 'The document is locked by another user or process. Try again later.'], Http::STATUS_LOCKED);
		} catch (StorageNotAvailableException | StorageInvalidException) {
			return new JSONResponse(['message' => 'The storage for this folder is unavailable. Try again later.'], Http::STATUS_SERVICE_UNAVAILABLE);
		} catch (NotPermittedException) {
			return new JSONResponse(['message' => 'Cannot save the document in this folder. It may be read-only.'], Http::STATUS_FORBIDDEN);
		} catch (\Throwable $e) {
			ClientLogController::reportServerException($this->logger, __METHOD__, $e);
			throw $e;
		}
	}
}
