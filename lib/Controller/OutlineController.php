<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCA\NcOutliner\Opml\OpmlParseException;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Opml\Row;
use OCA\NcOutliner\Service\ConflictException;
use OCA\NcOutliner\Service\NotFoundException;
use OCA\NcOutliner\Service\IOutlineStore;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\JSONResponse;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http;
use OCP\IRequest;
use OCP\IUserSession;

final class OutlineController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IOutlineStore $store,
		private readonly IUserSession $userSession,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	public function index(): JSONResponse {
		return new JSONResponse($this->store->list($this->uid()));
	}

	#[NoAdminRequired]
	public function create(string $name = ''): JSONResponse {
		try {
			return new JSONResponse($this->store->create($this->uid(), $name), Http::STATUS_CREATED);
		} catch (\InvalidArgumentException $e) {
			return new JSONResponse(['message' => $e->getMessage()], Http::STATUS_BAD_REQUEST);
		}
	}

	#[NoAdminRequired]
	public function show(int $fileId): JSONResponse {
		try {
			$result = $this->store->read($this->uid(), $fileId);
			$result['outline'] = $this->outlineToArray($result['outline']);
			return new JSONResponse($result);
		} catch (NotFoundException) {
			return new JSONResponse([], Http::STATUS_NOT_FOUND);
		} catch (OpmlParseException) {
			return new JSONResponse(['message' => 'This file is not a readable outline'], Http::STATUS_UNPROCESSABLE_ENTITY);
		}
	}

	#[NoAdminRequired]
	public function update(int $fileId): JSONResponse {
		$params = $this->request->getParams();
		$ifMatch = $this->request->getHeader('If-Match');
		if ($ifMatch === '') {
			return new JSONResponse(['message' => 'If-Match header is required'], Http::STATUS_BAD_REQUEST);
		}
		$outline = $this->outlineParam($params);
		if ($outline === null) {
			return $this->outlineRequired();
		}

		try {
			$etag = $this->store->save($this->uid(), $fileId, $this->outlineFromArray($outline), $ifMatch);
			return new JSONResponse(['etag' => $etag]);
		} catch (ConflictException $e) {
			return new JSONResponse(['etag' => $e->currentEtag], Http::STATUS_PRECONDITION_FAILED);
		} catch (NotFoundException) {
			return new JSONResponse([], Http::STATUS_NOT_FOUND);
		}
	}

	#[NoAdminRequired]
	public function copy(int $fileId): JSONResponse {
		$params = $this->request->getParams();
		$outline = $this->outlineParam($params);
		if ($outline === null) {
			return $this->outlineRequired();
		}
		try {
			return new JSONResponse(
				$this->store->saveCopy($this->uid(), $fileId, $this->outlineFromArray($outline)),
				Http::STATUS_CREATED,
			);
		} catch (NotFoundException) {
			return new JSONResponse([], Http::STATUS_NOT_FOUND);
		}
	}

	/**
	 * @param array<string, mixed> $params
	 * @return ?array<string, mixed> the outline payload, or null when it is missing or has no rows array
	 */
	private function outlineParam(array $params): ?array {
		$outline = $params['outline'] ?? null;
		if (!is_array($outline) || !isset($outline['rows']) || !is_array($outline['rows'])) {
			return null;
		}
		return $outline;
	}

	private function outlineRequired(): JSONResponse {
		return new JSONResponse(['message' => 'outline with a rows array is required'], Http::STATUS_BAD_REQUEST);
	}

	private function uid(): string {
		return $this->userSession->getUser()->getUID();
	}

	/** @param array<string, mixed> $data */
	private function outlineFromArray(array $data): Outline {
		$rows = [];
		foreach ((array)($data['rows'] ?? []) as $row) {
			$rows[] = Row::fromArray((array)$row);
		}
		return new Outline((string)($data['title'] ?? ''), $rows, isset($data['publishPath']) ? (string)$data['publishPath'] : null, array_values(array_filter((array)($data['headExtra'] ?? []), 'is_string')));
	}

	/** @return array{title: string, rows: list<array<string, mixed>>, publishPath: ?string, headExtra: list<string>} */
	private function outlineToArray(Outline $outline): array {
		return [
			'title' => $outline->title,
			'rows' => array_map(static fn (Row $row): array => $row->toArray(), $outline->rows),
			'publishPath' => $outline->publishPath,
			'headExtra' => $outline->headExtra,
		];
	}
}
