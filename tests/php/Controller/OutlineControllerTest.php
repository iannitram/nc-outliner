<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\OutlineController;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Opml\Row;
use OCA\NcOutliner\Service\ConflictException;
use OCA\NcOutliner\Service\NotFoundException;
use OCA\NcOutliner\Service\IOutlineStore;
use OCP\AppFramework\Http;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

final class OutlineControllerTest extends TestCase {
	private IOutlineStore $store;
	private IRequest $request;
	private IUserSession $userSession;
	private OutlineController $controller;

	protected function setUp(): void {
		$this->store = $this->createMock(IOutlineStore::class);
		$this->request = $this->createMock(IRequest::class);
		$this->userSession = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$this->userSession->method('getUser')->willReturn($user);
		$this->controller = new OutlineController($this->request, $this->store, $this->userSession);
	}

	public function testListUsesSignedInUser(): void {
		$items = [['fileId' => 7, 'name' => 'Plan.opml', 'mtime' => 123]];
		$this->store->expects($this->once())->method('list')->with('alice')->willReturn($items);

		$response = $this->controller->index();
		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame($items, $response->getData());
	}

	public function testCreateReturnsCreatedOutline(): void {
		$result = ['fileId' => 7, 'name' => 'Plan.opml', 'etag' => 'e1'];
		$this->store->expects($this->once())->method('create')->with('alice', 'Plan')->willReturn($result);

		$response = $this->controller->create('Plan');
		$this->assertSame(Http::STATUS_CREATED, $response->getStatus());
		$this->assertSame($result, $response->getData());
	}

	public function testReadReturnsOutlineRowsAsJsonArraysAndUnknownIs404(): void {
		$outline = new Outline('Plan', [new Row('r1', 'First')], null);
		$this->store->expects($this->exactly(2))->method('read')->with('alice', 7)
			->willReturnOnConsecutiveCalls(
				['fileId' => 7, 'name' => 'Plan.opml', 'etag' => 'e1', 'outline' => $outline],
				$this->throwException(new NotFoundException()),
			);

		$response = $this->controller->show(7);
		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame([
			'fileId' => 7,
			'name' => 'Plan.opml',
			'etag' => 'e1',
			'outline' => ['title' => 'Plan', 'rows' => [
				['id' => 'r1', 'text' => 'First', 'note' => '', 'collapsed' => false, 'children' => []],
			], 'publishPath' => null],
		], $response->getData());
		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller->show(7)->getStatus());
	}

	public function testUpdateRequiresIfMatchAndReturnsEtagOrConflict(): void {
		$this->request->expects($this->exactly(3))->method('getHeader')->with('If-Match')
			->willReturnOnConsecutiveCalls('', 'e1', 'old');
		$this->request->expects($this->exactly(3))->method('getParams')->willReturn([
			'outline' => ['title' => 'Plan', 'rows' => [['id' => 'r1', 'text' => 'First']]],
		]);
		$this->store->expects($this->exactly(2))->method('save')->with(
			'alice', 7,
			$this->callback(static fn (Outline $outline): bool => $outline->title === 'Plan' && $outline->rows[0]->id === 'r1'),
			$this->logicalOr($this->equalTo('e1'), $this->equalTo('old')),
		)->willReturnOnConsecutiveCalls('e2', $this->throwException(new ConflictException('current')));

		$missing = $this->controller->update(7);
		$this->assertSame(Http::STATUS_BAD_REQUEST, $missing->getStatus());
		$this->assertSame(['message' => 'If-Match header is required'], $missing->getData());
		$saved = $this->controller->update(7);
		$this->assertSame(Http::STATUS_OK, $saved->getStatus());
		$this->assertSame(['etag' => 'e2'], $saved->getData());
		$conflict = $this->controller->update(7);
		$this->assertSame(Http::STATUS_PRECONDITION_FAILED, $conflict->getStatus());
		$this->assertSame(['etag' => 'current'], $conflict->getData());
	}

	public function testSaveCopyReturnsCreatedOrNotFound(): void {
		$this->request->expects($this->exactly(2))->method('getParams')->willReturn([
			'outline' => ['title' => 'Plan', 'rows' => []],
		]);
		$this->store->expects($this->exactly(2))->method('saveCopy')->with(
			'alice', 7, $this->callback(static fn (Outline $outline): bool => $outline->title === 'Plan'),
		)->willReturnOnConsecutiveCalls(
			['fileId' => 8, 'name' => 'Plan (my copy).opml', 'etag' => 'e8'],
			$this->throwException(new NotFoundException()),
		);

		$copy = $this->controller->copy(7);
		$this->assertSame(Http::STATUS_CREATED, $copy->getStatus());
		$this->assertSame(8, $copy->getData()['fileId']);
		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller->copy(7)->getStatus());
	}
}
