<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\OutlineController;
use OCA\NcOutliner\Service\IOutlineStore;
use OCP\AppFramework\Http;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

final class OutlineControllerNameTest extends TestCase {
	public function testCreateAnswers400WithTheMessageWhenTheStoreRefusesTheName(): void {
		$store = $this->createMock(IOutlineStore::class);
		$store->expects($this->once())->method('create')->with('alice', 'Plan: v2')
			->willThrowException(new \InvalidArgumentException('bad name'));
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$userSession = $this->createMock(IUserSession::class);
		$userSession->method('getUser')->willReturn($user);
		$controller = new OutlineController($this->createMock(IRequest::class), $store, $userSession);

		$response = $controller->create('Plan: v2');

		$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
		$this->assertSame(['message' => 'bad name'], $response->getData());
	}
}
