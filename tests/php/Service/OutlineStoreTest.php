<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Service;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Opml\Row;
use OCA\NcOutliner\Service\ConflictException;
use OCA\NcOutliner\Service\NotFoundException;
use OCA\NcOutliner\Service\OutlineStore;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Lock\ILockingProvider;
use OCP\Lock\LockedException;
use PHPUnit\Framework\TestCase;

final class OutlineStoreTest extends TestCase {
	public function testFolderIsCreatedOnce(): void {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$codec = new OpmlCodec();

		$rootFolder->expects($this->exactly(2))
			->method('getUserFolder')
			->with('alice')
			->willReturn($userFolder);

		// First call: folder does not exist -> creates it.
		// Second call: folder exists -> returns it.
		$userFolder->expects($this->exactly(2))
			->method('nodeExists')
			->with('Outlines')
			->willReturnOnConsecutiveCalls(false, true);

		$userFolder->expects($this->once())
			->method('newFolder')
			->with('Outlines')
			->willReturn($outlinesFolder);

		$userFolder->expects($this->once())
			->method('get')
			->with('Outlines')
			->willReturn($outlinesFolder);

		$store = new OutlineStore($rootFolder, $codec);

		$first = $store->ensureFolder('alice');
		$second = $store->ensureFolder('alice');

		$this->assertSame($outlinesFolder, $first);
		$this->assertSame($outlinesFolder, $second);
	}

	public function testListReturnsOnlyOpmlFilesNewestFirst(): void {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$codec = new OpmlCodec();

		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($outlinesFolder);

		$fileOlder = $this->createMock(File::class);
		$fileOlder->method('getId')->willReturn(101);
		$fileOlder->method('getName')->willReturn('Older.opml');
		$fileOlder->method('getMTime')->willReturn(1000);

		$fileNewer = $this->createMock(File::class);
		$fileNewer->method('getId')->willReturn(102);
		$fileNewer->method('getName')->willReturn('Newer.opml');
		$fileNewer->method('getMTime')->willReturn(2000);

		$nonOpmlFile = $this->createMock(File::class);
		$nonOpmlFile->method('getId')->willReturn(103);
		$nonOpmlFile->method('getName')->willReturn('notes.txt');
		$nonOpmlFile->method('getMTime')->willReturn(3000);

		$subFolder = $this->createMock(Folder::class);
		$subFolder->method('getId')->willReturn(104);
		$subFolder->method('getName')->willReturn('Subfolder.opml');

		$outlinesFolder->expects($this->once())
			->method('getDirectoryListing')
			->willReturn([$fileOlder, $nonOpmlFile, $subFolder, $fileNewer]);

		$store = new OutlineStore($rootFolder, $codec);
		$list = $store->list('alice');

		$this->assertSame([
			[
				'fileId' => 102,
				'name' => 'Newer.opml',
				'mtime' => 2000,
			],
			[
				'fileId' => 101,
				'name' => 'Older.opml',
				'mtime' => 1000,
			],
		], $list);
	}

	public function testCreatePicksUntitledThenUntitled2AndTreatsNamesDifferingOnlyByCaseAsTaken(): void {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$codec = new OpmlCodec();

		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($outlinesFolder);

		$file1 = $this->createMock(File::class);
		$file1->method('getId')->willReturn(1);
		$file1->method('getName')->willReturn('Untitled.opml');
		$file1->method('getEtag')->willReturn('etag1');
		$file1->expects($this->once())->method('putContent')->with($this->isType('string'));

		$file2 = $this->createMock(File::class);
		$file2->method('getId')->willReturn(2);
		$file2->method('getName')->willReturn('Untitled (2).opml');
		$file2->method('getEtag')->willReturn('etag2');
		$file2->expects($this->once())->method('putContent')->with($this->isType('string'));

		$file3 = $this->createMock(File::class);
		$file3->method('getId')->willReturn(3);
		$file3->method('getName')->willReturn('Untitled (2).opml');
		$file3->method('getEtag')->willReturn('etag3');
		$file3->expects($this->once())->method('putContent')->with($this->isType('string'));

		$existingLowercase = $this->createMock(File::class);
		$existingLowercase->method('getName')->willReturn('untitled.opml');

		$outlinesFolder->expects($this->exactly(3))
			->method('getDirectoryListing')
			->willReturnOnConsecutiveCalls(
				[],
				[$file1],
				[$existingLowercase],
			);

		$callIndex = 0;
		$outlinesFolder->expects($this->exactly(3))
			->method('newFile')
			->willReturnCallback(function (string $path) use (&$callIndex, $file1, $file2, $file3): File {
				$callIndex++;
				if ($callIndex === 1) {
					$this->assertSame('Untitled.opml', $path);
					return $file1;
				}
				if ($callIndex === 2) {
					$this->assertSame('Untitled (2).opml', $path);
					return $file2;
				}
				$this->assertSame('Untitled (2).opml', $path);
				return $file3;
			});

		$store = new OutlineStore($rootFolder, $codec);

		// 1. Picks "Untitled" when name is empty
		$res1 = $store->create('alice', '');
		$this->assertSame('Untitled.opml', $res1['name']);
		$this->assertSame(1, $res1['fileId']);

		// 2. Picks "Untitled (2)" when Untitled.opml already exists
		$res2 = $store->create('alice', '');
		$this->assertSame('Untitled (2).opml', $res2['name']);
		$this->assertSame(2, $res2['fileId']);

		// 3. Treats names differing only by case as taken
		$res3 = $store->create('alice', 'Untitled');
		$this->assertSame('Untitled (2).opml', $res3['name']);
		$this->assertSame(3, $res3['fileId']);

		// Also verify invalid characters and trailing dots or spaces are refused
		foreach (['bad/name', 'bad\\name', 'bad:name', 'bad*name', 'bad?name', 'bad"name', 'bad<name', 'bad>name', 'bad|name'] as $badChar) {
			try {
				$store->create('alice', $badChar);
				$this->fail("Expected InvalidArgumentException for forbidden character in {$badChar}");
			} catch (\InvalidArgumentException) {
				$this->addToAssertionCount(1);
			}
		}

		foreach (['trailing ', 'trailing.', 'trailing .opml', 'trailing..opml'] as $badSuffix) {
			try {
				$store->create('alice', $badSuffix);
				$this->fail("Expected InvalidArgumentException for trailing dot/space in {$badSuffix}");
			} catch (\InvalidArgumentException) {
				$this->addToAssertionCount(1);
			}
		}
	}

	public function testReadOfAnotherUsersOrNonOutlineFileIdThrowsNotFoundException(): void {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$codec = new OpmlCodec();

		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($outlinesFolder);

		$validFile = $this->createMock(File::class);
		$validFile->method('getId')->willReturn(123);
		$validFile->method('getName')->willReturn('Plan.opml');
		$validFile->method('getEtag')->willReturn('etag123');
		$validFile->method('getContent')->willReturn(
			'<opml version="2.0" xmlns:nco="' . OpmlCodec::NS . '"><head><title>Plan</title></head><body><outline text="Item 1"/></body></opml>',
		);

		$nonOutlineFile = $this->createMock(File::class);
		$nonOutlineFile->method('getId')->willReturn(555);
		$nonOutlineFile->method('getName')->willReturn('photo.jpg');

		$subFolderNode = $this->createMock(Folder::class);
		$subFolderNode->method('getId')->willReturn(777);
		$subFolderNode->method('getName')->willReturn('Sub.opml');

		$outlinesFolder->method('getById')->willReturnCallback(function (int $id) use ($validFile, $nonOutlineFile, $subFolderNode): array {
			return match ($id) {
				123 => [$validFile],
				555 => [$nonOutlineFile],
				777 => [$subFolderNode],
				default => [], // 999: another user's file id not in alice's Outlines folder
			};
		});

		$store = new OutlineStore($rootFolder, $codec);

		// Another user's file id throws NotFoundException
		try {
			$store->read('alice', 999);
			$this->fail('Expected NotFoundException for another user\'s file id');
		} catch (NotFoundException) {
			$this->addToAssertionCount(1);
		}

		// Non-outline file id throws NotFoundException
		try {
			$store->read('alice', 555);
			$this->fail('Expected NotFoundException for a non-outline file id');
		} catch (NotFoundException) {
			$this->addToAssertionCount(1);
		}

		// Folder node with .opml extension throws NotFoundException
		try {
			$store->read('alice', 777);
			$this->fail('Expected NotFoundException for a directory node');
		} catch (NotFoundException) {
			$this->addToAssertionCount(1);
		}

		// Valid outline file reads and parses successfully
		$readResult = $store->read('alice', 123);
		$this->assertSame(123, $readResult['fileId']);
		$this->assertSame('Plan.opml', $readResult['name']);
		$this->assertSame('etag123', $readResult['etag']);
		$this->assertSame('Plan', $readResult['outline']->title);
		$this->assertCount(1, $readResult['outline']->rows);
		$this->assertSame('Item 1', $readResult['outline']->rows[0]->text);
	}

	public function testSaveWithStaleEtagThrowsConflictExceptionCarryingCurrentEtagAndWritesNothing(): void {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$file = $this->createMock(File::class);
		$codec = new OpmlCodec();

		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($outlinesFolder);

		$file->method('getId')->willReturn(42);
		$file->method('getName')->willReturn('Plan.opml');
		$file->method('getEtag')->willReturnOnConsecutiveCalls('etag-current', 'etag-current', 'etag-new');

		// Writes nothing on stale etag conflict
		$file->expects($this->once())->method('putContent')->with($this->isType('string'));

		$outlinesFolder->method('getById')->with(42)->willReturn([$file]);

		$store = new OutlineStore($rootFolder, $codec);
		$outline = new Outline('Plan', [new Row('r1', 'Row 1', '')]);

		// 1. Stale etag throws ConflictException and writes nothing
		try {
			$store->save('alice', 42, $outline, 'etag-stale');
			$this->fail('Expected ConflictException when saving with stale etag');
		} catch (ConflictException $e) {
			$this->assertSame('etag-current', $e->currentEtag);
		}

		// 2. Matching etag saves successfully and returns new etag
		$newEtag = $store->save('alice', 42, $outline, 'etag-current');
		$this->assertSame('etag-new', $newEtag);
	}

	public function testSaveTakesExclusiveLockAroundEtagCheckAndWrite(): void {
		[$store, $file] = $this->storeWithRecordingFile();
		$events = [];
		$file->method('getEtag')->willReturnCallback(function () use (&$events): string {
			$events[] = 'getEtag';
			return 'etag-1';
		});
		$file->expects($this->once())->method('lock')->with(ILockingProvider::LOCK_EXCLUSIVE)
			->willReturnCallback(function () use (&$events): void {
				$events[] = 'lock';
			});
		$file->expects($this->once())->method('putContent')->willReturnCallback(function () use (&$events): void {
			$events[] = 'putContent';
		});
		$file->expects($this->once())->method('unlock')->with(ILockingProvider::LOCK_EXCLUSIVE)
			->willReturnCallback(function () use (&$events): void {
				$events[] = 'unlock';
			});

		$etag = $store->save('alice', 42, new Outline('Plan', [new Row('r1', 'Row 1', '')]), 'etag-1');

		$this->assertSame('etag-1', $etag);
		$this->assertSame(['lock', 'getEtag', 'putContent', 'getEtag', 'unlock'], $events);
	}

	public function testSaveReleasesLockWhenPutContentThrows(): void {
		[$store, $file] = $this->storeWithRecordingFile();
		$events = [];
		$file->method('getEtag')->willReturn('etag-1');
		$file->expects($this->once())->method('lock')->with(ILockingProvider::LOCK_EXCLUSIVE)
			->willReturnCallback(function () use (&$events): void {
				$events[] = 'lock';
			});
		$file->expects($this->once())->method('putContent')
			->willThrowException(new \RuntimeException('disk full'));
		$file->expects($this->once())->method('unlock')->with(ILockingProvider::LOCK_EXCLUSIVE)
			->willReturnCallback(function () use (&$events): void {
				$events[] = 'unlock';
			});

		try {
			$store->save('alice', 42, new Outline('Plan', []), 'etag-1');
			$this->fail('Expected the write failure to propagate');
		} catch (\RuntimeException $e) {
			$this->assertSame('disk full', $e->getMessage());
		}

		$this->assertSame(['lock', 'unlock'], $events);
	}

	public function testSaveMapsLockedExceptionToConflictWithCurrentEtagAndWritesNothing(): void {
		[$store, $file] = $this->storeWithRecordingFile();
		$file->method('getEtag')->willReturn('etag-current');
		$file->expects($this->once())->method('lock')
			->willThrowException(new LockedException('/Outlines/Plan.opml'));
		$file->expects($this->never())->method('putContent');
		$file->expects($this->never())->method('unlock');

		try {
			$store->save('alice', 42, new Outline('Plan', []), 'etag-current');
			$this->fail('Expected ConflictException when the file is locked');
		} catch (ConflictException $e) {
			$this->assertSame('etag-current', $e->currentEtag);
		}
	}

	public function testSecondSaveWithSameIfMatchIsRefusedWhileFirstHoldsTheLock(): void {
		[$store, $file] = $this->storeWithRecordingFile();
		$held = false;
		$writes = 0;
		$secondOutcome = null;

		$file->method('getEtag')->willReturn('etag-1');
		$file->method('lock')->willReturnCallback(function () use (&$held): void {
			if ($held) {
				throw new LockedException('/Outlines/Plan.opml');
			}
			$held = true;
		});
		$file->method('unlock')->willReturnCallback(function () use (&$held): void {
			$held = false;
		});
		// The first save is still inside putContent() when the second save arrives.
		$file->expects($this->once())->method('putContent')->willReturnCallback(
			function () use ($store, &$writes, &$secondOutcome): void {
				$writes++;
				try {
					$store->save('alice', 42, new Outline('Second', []), 'etag-1');
					$secondOutcome = 'saved';
				} catch (ConflictException $e) {
					$secondOutcome = $e->currentEtag;
				}
			},
		);

		$firstEtag = $store->save('alice', 42, new Outline('First', []), 'etag-1');

		$this->assertSame('etag-1', $firstEtag);
		$this->assertSame(1, $writes);
		$this->assertSame('etag-1', $secondOutcome);
		$this->assertFalse($held);
	}

	/**
	 * A store over a mocked File with id 42 in the user's Outlines folder.
	 *
	 * @return array{0: OutlineStore, 1: File&\PHPUnit\Framework\MockObject\MockObject}
	 */
	private function storeWithRecordingFile(): array {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$file = $this->createMock(File::class);

		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($outlinesFolder);

		$file->method('getId')->willReturn(42);
		$file->method('getName')->willReturn('Plan.opml');
		$outlinesFolder->method('getById')->with(42)->willReturn([$file]);

		return [new OutlineStore($rootFolder, new OpmlCodec()), $file];
	}

	public function testSaveCopyWritesNameMyCopyOpml(): void {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$originalFile = $this->createMock(File::class);
		$copyFile = $this->createMock(File::class);
		$codec = new OpmlCodec();

		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($outlinesFolder);

		$originalFile->method('getId')->willReturn(10);
		$originalFile->method('getName')->willReturn('Project Plan.opml');
		$originalFile->method('getEtag')->willReturn('orig-etag');

		$copyFile->method('getId')->willReturn(20);
		$copyFile->method('getName')->willReturn('Project Plan (my copy).opml');
		$copyFile->method('getEtag')->willReturn('copy-etag');

		$outlinesFolder->method('getById')->with(10)->willReturn([$originalFile]);
		$outlinesFolder->method('getDirectoryListing')->willReturn([$originalFile]);

		$outlinesFolder->expects($this->once())
			->method('newFile')
			->with('Project Plan (my copy).opml')
			->willReturn($copyFile);

		$copyFile->expects($this->once())
			->method('putContent')
			->with($this->callback(static function (string $xml): bool {
				return str_contains($xml, 'Project Plan');
			}));

		$store = new OutlineStore($rootFolder, $codec);
		$outline = new Outline('Project Plan', [new Row('r1', 'Item 1', '')]);

		$result = $store->saveCopy('alice', 10, $outline);

		$this->assertSame([
			'fileId' => 20,
			'name' => 'Project Plan (my copy).opml',
			'etag' => 'copy-etag',
		], $result);
	}
}
