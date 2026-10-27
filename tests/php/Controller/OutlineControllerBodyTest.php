<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\OutlineController;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Service\IOutlineStore;
use OCP\AppFramework\Http;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class OutlineControllerBodyTest extends TestCase {
	/** @return array<string, array{array<string, mixed>}> */
	public static function badBodies(): array {
		return [
			'no params' => [[]],
			'outline is a string' => [['outline' => 'x']],
			'outline has no rows' => [['outline' => ['title' => 'T']]],
		];
	}

	/** @param array<string, mixed> $params */
	private function makeController(IOutlineStore $store, array $params): OutlineController {
		$request = $this->createMock(IRequest::class);
		$request->method('getParams')->willReturn($params);
		$request->method('getHeader')->with('If-Match')->willReturn('e1');
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$userSession = $this->createMock(IUserSession::class);
		$userSession->method('getUser')->willReturn($user);
		return new OutlineController($request, $store, $userSession);
	}

	/** @param array<string, mixed> $params */
	#[DataProvider('badBodies')]
	public function testUpdateWithoutAUsableOutlineAnswers400AndNeverSaves(array $params): void {
		$store = $this->createMock(IOutlineStore::class);
		$store->expects($this->never())->method('save');

		$response = $this->makeController($store, $params)->update(7);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertIsString($response->getData()['message'] ?? null);
		$this->assertNotSame('', $response->getData()['message']);
	}

	/** @param array<string, mixed> $params */
	#[DataProvider('badBodies')]
	public function testCopyWithoutAUsableOutlineAnswers400AndNeverSavesACopy(array $params): void {
		$store = $this->createMock(IOutlineStore::class);
		$store->expects($this->never())->method('saveCopy');

		$response = $this->makeController($store, $params)->copy(7);

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertIsString($response->getData()['message'] ?? null);
		$this->assertNotSame('', $response->getData()['message']);
	}

	public function testUpdateStillSavesAnOutlineWithAnEmptyRowsArray(): void {
		$store = $this->createMock(IOutlineStore::class);
		$store->expects($this->once())->method('save')
			->with('alice', 7, $this->isInstanceOf(Outline::class), 'e1')
			->willReturn('e2');

		$response = $this->makeController($store, ['outline' => ['title' => 'T', 'rows' => []]])->update(7);

		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['etag' => 'e2'], $response->getData());
	}

	public function testCopyStillSavesAnOutlineWithAnEmptyRowsArray(): void {
		$result = ['fileId' => 8, 'name' => 'T (my copy).opml', 'etag' => 'e8'];
		$store = $this->createMock(IOutlineStore::class);
		$store->expects($this->once())->method('saveCopy')
			->with('alice', 7, $this->isInstanceOf(Outline::class))
			->willReturn($result);

		$response = $this->makeController($store, ['outline' => ['title' => 'T', 'rows' => []]])->copy(7);

		$this->assertSame(Http::STATUS_CREATED, $response->getStatus());
		$this->assertSame($result, $response->getData());
	}
}
