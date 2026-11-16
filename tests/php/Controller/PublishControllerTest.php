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
use OCP\AppFramework\Http\JSONResponse;
use OCP\Files\Folder;
use OCP\Files\File;
use OCP\Files\NotPermittedException;
use OCP\Files\StorageInvalidException;
use OCP\Files\StorageNotAvailableException;
use OCP\Files\IRootFolder;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUser;
use OCP\IUserSession;
use OCP\Lock\LockedException;
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
		$urls->expects($this->once())->method('linkToRoute')->with('files.View.showFile', ['fileid'=>22])->willReturn('/index.php/f/22');
		$controller = new PublishController($this->createMock(IRequest::class), $service, $session, $urls);
		$response = $controller->publish(7, '', 'Plan');
		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['fileId'=>22,'path'=>'/Plan.odt','openUrl'=>'/index.php/f/22'], $response->getData());
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

	public function testDotAndDoubleDotNamesReturn400WithNameMessage(): void {
		$userFolder = $this->createMock(Folder::class);
		$root = $this->createMock(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		$userFolder->method('get')->willReturn($this->createMock(Folder::class));
		$store = $this->createMock(IOutlineStore::class);
		$store->method('read')->willReturn(['fileId' => 7, 'name' => 'x', 'etag' => 'e', 'outline' => new Outline('Plan', [])]);
		$session = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session->method('getUser')->willReturn($user);
		$controller = new PublishController($this->createMock(IRequest::class), new PublishService($store, $root, new ContentWriter(), new OdtPackage()), $session, $this->createMock(IURLGenerator::class));
		foreach (['.', '..'] as $name) {
			$response = $controller->publish(7, '', $name);
			$this->assertSame(Http::STATUS_BAD_REQUEST, $response->getStatus());
			$this->assertSame('Invalid document name', $response->getData()['message']);
		}
	}

	public function testUnwritableDestinationReturns403WithMessage(): void {
		$userFolder = $this->createMock(Folder::class);
		$destination = $this->createMock(Folder::class);
		$root = $this->createMock(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		$userFolder->method('get')->willReturn($destination);
		$destination->method('nodeExists')->willReturn(false);
		$destination->method('newFile')->willThrowException(new NotPermittedException('read-only'));
		$store = $this->createMock(IOutlineStore::class);
		$store->method('read')->willReturn(['fileId' => 7, 'name' => 'x', 'etag' => 'e', 'outline' => new Outline('Plan', [])]);
		$service = new PublishService($store, $root, new ContentWriter(), new OdtPackage());
		$session = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session->method('getUser')->willReturn($user);
		$controller = new PublishController($this->createMock(IRequest::class), $service, $session, $this->createMock(IURLGenerator::class));
		$response = $controller->publish(7, '', 'Plan');
		$this->assertSame(Http::STATUS_FORBIDDEN, $response->getStatus());
		$this->assertIsString($response->getData()['message'] ?? null);
		$this->assertNotSame('', $response->getData()['message']);
	}

	public function testLockedDestinationReturns423WithMessage(): void {
		$response = $this->publishWhenNewFileThrows(new LockedException('/Plan.odt'));
		$this->assertSame(Http::STATUS_LOCKED, $response->getStatus());
		$this->assertSame('The document is locked by another user or process. Try again later.', $response->getData()['message']);
	}

	public function testUnavailableStorageReturns503WithMessage(): void {
		$response = $this->publishWhenNewFileThrows($this->createMock(StorageNotAvailableException::class)); // ctor needs OC, not stubbed
		$this->assertSame(Http::STATUS_SERVICE_UNAVAILABLE, $response->getStatus());
		$this->assertSame('The storage for this folder is unavailable. Try again later.', $response->getData()['message']);
	}

	public function testInvalidStorageReturns503WithMessage(): void {
		$response = $this->publishWhenNewFileThrows(new StorageInvalidException('broken'));
		$this->assertSame(Http::STATUS_SERVICE_UNAVAILABLE, $response->getStatus());
		$this->assertSame('The storage for this folder is unavailable. Try again later.', $response->getData()['message']);
	}

	public function testUnrelatedErrorStillPropagates(): void {
		$this->expectException(\RuntimeException::class);
		$this->publishWhenNewFileThrows(new \RuntimeException('boom'));
	}

	private function publishWhenNewFileThrows(\Throwable $error): JSONResponse {
		$userFolder = $this->createMock(Folder::class);
		$destination = $this->createMock(Folder::class);
		$root = $this->createMock(IRootFolder::class);
		$root->method('getUserFolder')->willReturn($userFolder);
		$userFolder->method('get')->willReturn($destination);
		$destination->method('nodeExists')->willReturn(false);
		$destination->method('newFile')->willThrowException($error);
		$store = $this->createMock(IOutlineStore::class);
		$store->method('read')->willReturn(['fileId' => 7, 'name' => 'x', 'etag' => 'e', 'outline' => new Outline('Plan', [])]);
		$service = new PublishService($store, $root, new ContentWriter(), new OdtPackage());
		$session = $this->createMock(IUserSession::class);
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session->method('getUser')->willReturn($user);
		$controller = new PublishController($this->createMock(IRequest::class), $service, $session, $this->createMock(IURLGenerator::class));
		return $controller->publish(7, '', 'Plan');
	}
}
