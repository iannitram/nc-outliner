<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\PublishController;
use OCA\NcOutliner\Odt\ContentWriter;
use OCA\NcOutliner\Odt\OdtPackage;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\NotFoundException;
use OCA\NcOutliner\Service\PublishService;
use OCP\AppFramework\Http;
use OCP\Files\Folder;
use OCP\Files\File;
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

final class PublishControllerTest extends TestCase {
	public function testReturnsFileIdPathAndOfficeOpenUrl(): void {
		$userFolder = $this->createMock(Folder::class);
		$destination = $this->createMock(Folder::class);
		$root = $this->createMock(IRootFolder::class);
		$root->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('get')->with('')->willReturn($destination);
		$userFolder->method('getRelativePath')->willReturn('/Plan.odt');
		$destination->method('nodeExists')->willReturn(false);
		$file = $this->createMock(\OCP\Files\File::class);
		$file->method('getId')->willReturn(22);
		$file->method('getPath')->willReturn('/alice/files/Plan.odt');
		$destination->method('newFile')->with('Plan.odt', $this->isType('string'))->willReturn($file);
		$store = $this->createMock(IOutlineStore::class);
		$store->method('read')->willReturn(['fileId'=>7,'name'=>'x','etag'=>'e','outline'=>new Outline('Plan',[])]);
		$service = new PublishService($store, $root, new ContentWriter(), new OdtPackage());
		$session = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session->method('getUser')->willReturn($user);
		$urls = $this->createMock(IURLGenerator::class);
		$urls->expects($this->once())->method('linkToRoute')->with('files.view.index', ['openfile'=>'true','fileid'=>22])->willReturn('/apps/files/?openfile=true&fileid=22');
		$controller = new PublishController($this->createMock(IRequest::class), $service, $session, $urls);
		$response = $controller->publish(7, '', 'Plan');
		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['fileId'=>22,'path'=>'/Plan.odt','openUrl'=>'/apps/files/?openfile=true&fileid=22'], $response->getData());
	}

	public function testMissingOutlineReturns404(): void {
		$store = $this->createMock(IOutlineStore::class);
		$store->method('read')->willThrowException(new NotFoundException());
		$root = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		$userFolder->method('get')->willReturn($this->createMock(Folder::class));
		$session = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session->method('getUser')->willReturn($user);
		$controller = new PublishController($this->createMock(IRequest::class), new PublishService($store, $root, new ContentWriter(), new OdtPackage()), $session, $this->createMock(IURLGenerator::class));
		$this->assertSame(Http::STATUS_NOT_FOUND, $controller->publish(7, '', 'Plan')->getStatus());
	}

	public function testInvalidDestinationAndNamesReturn400(): void {
		$userFolder = $this->createMock(Folder::class);
		$root = $this->createMock(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		$userFolder->method('get')->willReturn($this->createMock(File::class));
		$store = $this->createMock(IOutlineStore::class);
		$service = new PublishService($store, $root, new ContentWriter(), new OdtPackage());
		$session = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session->method('getUser')->willReturn($user);
		$controller = new PublishController($this->createMock(IRequest::class), $service, $session, $this->createMock(IURLGenerator::class));
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->publish(7, 'A/../B', 'Plan')->getStatus());
		$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->publish(7, '', 'Plan')->getStatus());
		foreach (str_split('\\/:*?"<>|') as $character) {
			$this->assertSame(Http::STATUS_BAD_REQUEST, $controller->publish(7, '', 'Plan' . $character)->getStatus());
		}
	}
}
