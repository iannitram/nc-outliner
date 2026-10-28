<?php
declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\PublishController;
use OCA\NcOutliner\Odt\ContentWriter;
use OCA\NcOutliner\Odt\OdtPackage;
use OCA\NcOutliner\Opml\OpmlParseException;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\NotFoundException;
use OCA\NcOutliner\Service\PublishService;
use OCP\Files\IRootFolder;
use OCP\Files\InvalidPathException;
use OCP\Files\NotPermittedException;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

final class PublishControllerTest extends TestCase {
	public function testSourceAndFilesystemFailuresHaveClientStatuses(): void {
		foreach ([[new NotFoundException(), 404], [new NotPermittedException(), 403],
			[new OpmlParseException(), 422], [new InvalidPathException(), 400]] as [$failure, $status]) {
			$store = $this->createMock(IOutlineStore::class);
			$store->method('read')->willThrowException($failure);
			$publisher = new PublishService($this->createMock(IRootFolder::class), $store,
				new ContentWriter(), new OdtPackage(), $this->createMock(IURLGenerator::class));
			$request = $this->createMock(IRequest::class);
			$request->method('getParams')->willReturn(['folder' => '', 'name' => 'Plan']);
			$user = $this->createMock(IUser::class);
			$user->method('getUID')->willReturn('alice');
			$session = $this->createMock(IUserSession::class);
			$session->method('getUser')->willReturn($user);
			$response = (new PublishController($request, $publisher, $session))->publish(7);
			$this->assertSame($status, $response->getStatus());
			$this->assertNotSame('', $response->getData()['message']);
		}
	}
}
