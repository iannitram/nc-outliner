<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\OutlineController;
use OCA\NcOutliner\Service\ConflictException;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\NotFoundException;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\DataDownloadResponse;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

/** Rename, duplicate, delete and download routes (#218, #219). */
final class OutlineControllerManageTest extends TestCase {
	private IOutlineStore $store;
	private OutlineController $controller;

	protected function setUp(): void {
		$this->store = $this->createMock(IOutlineStore::class);
		$session = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session->method('getUser')->willReturn($user);
		$this->controller = new OutlineController($this->createMock(IRequest::class), $this->store, $session);
	}

	public function testRenameReturnsTheNewName(): void {
		$result = ['fileId' => 7, 'name' => 'Plan.opml', 'etag' => 'e'];
		$this->store->expects($this->once())->method('rename')->with('alice', 7, 'Plan')->willReturn($result);
		$response = $this->controller->rename(7, 'Plan');
		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame($result, $response->getData());
	}

	public function testRenameWithABadNameIs400(): void {
		$this->store->method('rename')->willThrowException(new \InvalidArgumentException('Name contains forbidden characters'));
		$response = $this->controller->rename(7, 'a/b');
		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame('Name contains forbidden characters', $response->getData()['message']);
	}

	public function testRenameDuringASaveIs409(): void {
		$this->store->method('rename')->willThrowException(new ConflictException('e2'));
		$this->assertSame(Http::STATUS_CONFLICT, $this->controller->rename(7, 'X')->getStatus());
	}

	public function testDuplicateIs201(): void {
		$result = ['fileId' => 8, 'name' => 'Plan (copy).opml', 'etag' => 'e'];
		$this->store->method('duplicate')->with('alice', 7)->willReturn($result);
		$response = $this->controller->duplicate(7);
		$this->assertSame(Http::STATUS_CREATED, $response->getStatus());
		$this->assertSame($result, $response->getData());
	}

	public function testDestroyDeletes(): void {
		$this->store->expects($this->once())->method('delete')->with('alice', 7);
		$this->assertSame(Http::STATUS_OK, $this->controller->destroy(7)->getStatus());
	}

	public function testDestroyOfAnUnknownOutlineIs404(): void {
		$this->store->method('delete')->willThrowException(new NotFoundException('gone'));
		$this->assertSame(Http::STATUS_NOT_FOUND, $this->controller->destroy(7)->getStatus());
	}

	public function testDownloadSendsTheFile(): void {
		if (!class_exists(\Symfony\Component\String\UnicodeString::class)) {
			$this->markTestSkipped('DataDownloadResponse needs symfony/string, which only the server ships');
		}
		$this->store->method('download')->with('alice', 7)->willReturn(['name' => 'Plan.opml', 'content' => '<opml/>']);
		$response = $this->controller->download(7);
		$this->assertInstanceOf(DataDownloadResponse::class, $response);
		$this->assertSame('<opml/>', $response->render());
	}
}
