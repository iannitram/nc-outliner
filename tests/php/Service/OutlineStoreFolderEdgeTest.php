<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Service;

use OCA\NcOutliner\Controller\OutlineController;
use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Service\FolderConflictException;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\OutlineStore;
use OCP\Files\AlreadyExistsException;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotFoundException;
use OCP\Files\NotPermittedException;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\TestCase;

final class OutlineStoreFolderEdgeTest extends TestCase {
	private function store(Folder $home): OutlineStore {
		$root = $this->createMock(IRootFolder::class);
		$root->method('getUserFolder')->with('alice')->willReturn($home);
		return new OutlineStore($root, new OpmlCodec(), $this->createMock(\OCP\Lock\ILockingProvider::class));
	}

	public function testAlreadyExistsRaceReturnsWinningFolder(): void {
		$home = $this->createMock(Folder::class);
		$folder = $this->createMock(Folder::class);
		$home->method('nodeExists')->willReturn(false);
		$home->method('newFolder')->willThrowException(new AlreadyExistsException());
		$home->method('get')->with('Outlines')->willReturn($folder);
		$this->assertSame($folder, $this->store($home)->ensureFolder('alice'));
	}

	public function testExistingPlainFileNeverAttemptsCreation(): void {
		$home = $this->createMock(Folder::class);
		$home->method('nodeExists')->willReturn(true);
		$home->method('get')->willReturn($this->createMock(File::class));
		$home->expects($this->never())->method('newFolder');
		$this->expectException(FolderConflictException::class);
		$this->store($home)->ensureFolder('alice');
	}

	public function testGenuinePermissionDenialIsNotHidden(): void {
		$home = $this->createMock(Folder::class);
		$failure = new NotPermittedException('Denied');
		$home->method('nodeExists')->willReturn(false);
		$home->method('newFolder')->willThrowException($failure);
		$home->method('get')->willThrowException(new NotFoundException());
		$this->expectExceptionObject($failure);
		$this->store($home)->ensureFolder('alice');
	}

	public function testBothEntryPointsReturnConflictWhenOutlinesIsAFile(): void {
		$store = $this->createMock(IOutlineStore::class);
		$store->method('list')->willThrowException(new FolderConflictException());
		$store->method('create')->willThrowException(new FolderConflictException());
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createMock(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		$controller = new OutlineController($this->createMock(IRequest::class), $store, $session);
		foreach ([$controller->index(), $controller->create('Plan')] as $response) {
			$this->assertSame(409, $response->getStatus());
			$this->assertStringContainsString('Outlines', $response->getData()['message']);
		}
	}
}
