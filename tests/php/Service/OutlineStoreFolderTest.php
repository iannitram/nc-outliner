<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Service;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Service\OutlineStore;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Files\NotPermittedException;
use PHPUnit\Framework\TestCase;

final class OutlineStoreFolderTest extends TestCase {
	private function makeStore(Folder $userFolder): OutlineStore {
		$rootFolder = $this->createMock(IRootFolder::class);
		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		return new OutlineStore($rootFolder, new OpmlCodec());
	}

	public function testEnsureFolderUsesTheFolderAnotherRequestCreatedFirst(): void {
		$outlines = $this->createMock(Folder::class);
		$userFolder = $this->createMock(Folder::class);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(false);
		$userFolder->expects($this->once())->method('newFolder')->with('Outlines')
			->willThrowException(new NotPermittedException('Could not create folder'));
		$userFolder->method('get')->with('Outlines')->willReturn($outlines);

		$this->assertSame($outlines, $this->makeStore($userFolder)->ensureFolder('alice'));
	}

	public function testEnsureFolderRaisesAClearErrorWhenOutlinesIsAPlainFile(): void {
		$userFolder = $this->createMock(Folder::class);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($this->createMock(File::class));
		$userFolder->method('newFolder')->with('Outlines')
			->willThrowException(new NotPermittedException('Could not create folder'));
		$store = $this->makeStore($userFolder);

		$error = null;
		try {
			$store->ensureFolder('alice');
		} catch (\Throwable $caught) {
			$error = $caught;
		}

		$this->assertNotNull($error, 'a plain file named Outlines must raise an error');
		$this->assertNotInstanceOf(NotPermittedException::class, $error);
		$this->assertNotSame('', $error->getMessage());
	}
}
