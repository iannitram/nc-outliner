<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Service;

use OCA\NcOutliner\Odt\ContentWriter;
use OCA\NcOutliner\Odt\OdtPackage;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Opml\Row;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\PublishService;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\IURLGenerator;
use PHPUnit\Framework\TestCase;

final class PublishServiceTest extends TestCase {
	public function testPublishesAndOverwritesDocumentInChosenFolder(): void {
		$root = $this->createMock(IRootFolder::class);
		$user = $this->createMock(Folder::class);
		$folder = $this->createMock(Folder::class);
		$file = $this->createMock(File::class);
		$store = $this->createMock(IOutlineStore::class);
		$urls = $this->createMock(IURLGenerator::class);
		$root->expects($this->exactly(2))->method('getUserFolder')->with('alice')->willReturn($user);
		$user->expects($this->exactly(2))->method('get')->with('Documents')->willReturn($folder);
		$store->expects($this->exactly(2))->method('read')->with('alice', 5)->willReturn([
			'outline' => new Outline('Plan', [new Row('r1', 'Heading')]),
		]);
		$folder->expects($this->exactly(2))->method('nodeExists')->with('Plan.odt')->willReturnOnConsecutiveCalls(false, true);
		$folder->expects($this->once())->method('newFile')->with('Plan.odt')->willReturn($file);
		$folder->expects($this->once())->method('get')->with('Plan.odt')->willReturn($file);
		$file->expects($this->exactly(2))->method('putContent')->with($this->callback(static fn (string $bytes): bool => str_starts_with($bytes, "PK")));
		$file->method('getId')->willReturn(42);
		$urls->method('linkToRouteAbsolute')->with('files.view.index', [
			'dir' => '/Documents', 'openfile' => true, 'fileid' => 42,
		])->willReturn('https://cloud.example/index.php/apps/files/?openfile=true&fileid=42');

		$service = new PublishService($root, $store, new ContentWriter(), new OdtPackage(), $urls);
		$first = $service->publish('alice', 5, 'Documents', 'Plan');
		$second = $service->publish('alice', 5, 'Documents', 'Plan.odt');
		$this->assertSame(['fileId' => 42, 'path' => '/Documents/Plan.odt', 'openUrl' => 'https://cloud.example/index.php/apps/files/?openfile=true&fileid=42'], $first);
		$this->assertSame($first, $second);
	}

	public function testRejectsTraversalNonFolderAndUnsafeName(): void {
		$root = $this->createMock(IRootFolder::class);
		$user = $this->createMock(Folder::class);
		$folder = $this->createMock(Folder::class);
		$store = $this->createMock(IOutlineStore::class);
		$urls = $this->createMock(IURLGenerator::class);
		$userFile = $this->createMock(File::class);
		$root->method('getUserFolder')->with('alice')->willReturn($user);
		$user->method('get')->willReturnCallback(static fn (string $path) => $path === 'Documents' ? $folder : $userFile);
		$store->method('read')->willReturn(['outline' => new Outline('Plan')]);
		$service = new PublishService($root, $store, new ContentWriter(), new OdtPackage(), $urls);
		foreach ([['../Other', 'Plan'], ['Documents', 'bad/name'], ["bad\0folder", 'Plan'], ['Documents', "bad\nname"]] as [$path, $name]) {
			try {
				$service->publish('alice', 5, $path, $name);
				$this->fail('Expected invalid publish target');
			} catch (\InvalidArgumentException) {
				$this->addToAssertionCount(1);
			}
		}
		try {
			$service->publish('alice', 5, 'file.txt', 'Plan');
			$this->fail('Expected non-folder target to be rejected');
		} catch (\InvalidArgumentException) {
			$this->addToAssertionCount(1);
		}
	}
}
