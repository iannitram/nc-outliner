<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Service;

use OCA\NcOutliner\Opml\OpmlCodec;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Service\ConflictException;
use OCA\NcOutliner\Service\OutlineStore;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use OCP\Lock\ILockingProvider;
use OCP\Lock\LockedException;
use PHPUnit\Framework\TestCase;

final class OutlineStoreSaveLockTest extends TestCase {
	public function testSaveLocksBeforeReadingEtagAndReleasesAfterWrite(): void {
		$order = [];
		[$rootFolder, $file] = $this->fileFixture($order);
		$lockingProvider = $this->createMock(ILockingProvider::class);
		$lockingProvider->expects($this->once())->method('acquireLock')
			->with('nc_outliner/save/7', ILockingProvider::LOCK_EXCLUSIVE)
			->willReturnCallback(static function () use (&$order): void { $order[] = 'acquire'; });
		$lockingProvider->expects($this->once())->method('releaseLock')
			->with('nc_outliner/save/7', ILockingProvider::LOCK_EXCLUSIVE)
			->willReturnCallback(static function () use (&$order): void { $order[] = 'release'; });
		$file->expects($this->exactly(2))->method('getEtag')
			->willReturnCallback(static function () use (&$order): string { $order[] = 'etag'; return count($order) === 2 ? 'old' : 'new'; });
		$file->expects($this->once())->method('putContent')
			->willReturnCallback(static function () use (&$order): void { $order[] = 'put'; });
		$file->expects($this->never())->method('lock');
		$file->expects($this->never())->method('unlock');

		$store = new OutlineStore($rootFolder, new OpmlCodec(), $lockingProvider);
		$store->save('alice', 7, new Outline('Plan', []), 'old');

		$this->assertSame(['acquire', 'etag', 'put', 'etag', 'release'], $order);
	}

	public function testPutFailureStillReleasesLockAndPropagates(): void {
		$order = [];
		[$rootFolder, $file] = $this->fileFixture($order);
		$lockingProvider = $this->createMock(ILockingProvider::class);
		$lockingProvider->expects($this->once())->method('acquireLock')->willReturnCallback(static function () use (&$order): void { $order[] = 'acquire'; });
		$lockingProvider->expects($this->once())->method('releaseLock')->willReturnCallback(static function () use (&$order): void { $order[] = 'release'; });
		$file->method('getEtag')->willReturn('old');
		$failure = new \RuntimeException('write failed');
		$file->expects($this->once())->method('putContent')->willThrowException($failure);

		$store = new OutlineStore($rootFolder, new OpmlCodec(), $lockingProvider);
		try {
			$store->save('alice', 7, new Outline('Plan', []), 'old');
			$this->fail('Expected write failure');
		} catch (\RuntimeException $exception) {
			$this->assertSame($failure, $exception);
		}
		$this->assertSame(['acquire', 'release'], $order);
	}

	public function testHeldLockBecomesConflictWithCurrentEtagWithoutReleaseOrWrite(): void {
		[$rootFolder, $file] = $this->fileFixture();
		$lockingProvider = $this->createMock(ILockingProvider::class);
		$lockingProvider->expects($this->once())->method('acquireLock')
			->with('nc_outliner/save/7', ILockingProvider::LOCK_EXCLUSIVE)
			->willThrowException(new LockedException('nc_outliner/save/7'));
		$lockingProvider->expects($this->never())->method('releaseLock');
		$file->expects($this->once())->method('getEtag')->willReturn('current');
		$file->expects($this->never())->method('putContent');

		$store = new OutlineStore($rootFolder, new OpmlCodec(), $lockingProvider);
		try {
			$store->save('alice', 7, new Outline('Plan', []), 'old');
			$this->fail('Expected lock conflict');
		} catch (ConflictException $exception) {
			$this->assertSame('current', $exception->currentEtag);
		}
	}

	public function testStaleEtagReleasesLockWithoutWriting(): void {
		$order = [];
		[$rootFolder, $file] = $this->fileFixture($order);
		$lockingProvider = $this->createMock(ILockingProvider::class);
		$lockingProvider->expects($this->once())->method('acquireLock')->willReturnCallback(static function () use (&$order): void { $order[] = 'acquire'; });
		$lockingProvider->expects($this->once())->method('releaseLock')->willReturnCallback(static function () use (&$order): void { $order[] = 'release'; });
		$file->expects($this->once())->method('getEtag')->willReturnCallback(static function () use (&$order): string { $order[] = 'etag'; return 'current'; });
		$file->expects($this->never())->method('putContent');
		$file->expects($this->never())->method('lock');
		$file->expects($this->never())->method('unlock');

		$store = new OutlineStore($rootFolder, new OpmlCodec(), $lockingProvider);
		try {
			$store->save('alice', 7, new Outline('Plan', []), 'stale');
			$this->fail('Expected stale etag conflict');
		} catch (ConflictException $exception) {
			$this->assertSame('current', $exception->currentEtag);
		}
		$this->assertSame(['acquire', 'etag', 'release'], $order);
	}

	/** @return array{IRootFolder, File} */
	private function fileFixture(?array &$order = null): array {
		$rootFolder = $this->createMock(IRootFolder::class);
		$userFolder = $this->createMock(Folder::class);
		$outlinesFolder = $this->createMock(Folder::class);
		$file = $this->createMock(File::class);
		$rootFolder->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$userFolder->method('nodeExists')->with('Outlines')->willReturn(true);
		$userFolder->method('get')->with('Outlines')->willReturn($outlinesFolder);
		$file->method('getId')->willReturn(7);
		$file->method('getName')->willReturn('Plan.opml');
		$file->expects($this->never())->method('lock');
		$file->expects($this->never())->method('unlock');
		$outlinesFolder->method('getById')->with(7)->willReturn([$file]);
		return [$rootFolder, $file];
	}
}
