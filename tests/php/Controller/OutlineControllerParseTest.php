<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\OutlineController;
use OCA\NcOutliner\Opml\OpmlParseException;
use OCA\NcOutliner\Service\IOutlineStore;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

final class OutlineControllerParseTest extends TestCase {
	public function testShowAnswers422WithAMessageWhenTheFileCannotBeParsed(): void {
		$store = $this->createMock(IOutlineStore::class);
		$store->expects($this->once())->method('read')->with('alice', 7)
			->willThrowException(new OpmlParseException('Invalid OPML XML'));
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$userSession = $this->createMock(IUserSession::class);
		$userSession->method('getUser')->willReturn($user);
		$controller = new OutlineController($this->createMock(IRequest::class), $store, $userSession);

		$response = $controller->show(7);

		$this->assertSame(422, $response->getStatus());
		$this->assertSame(['message'], array_keys($response->getData()));
		$this->assertIsString($response->getData()['message']);
		$this->assertNotSame('', $response->getData()['message']);
	}
}
