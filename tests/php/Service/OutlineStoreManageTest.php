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
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

/** Rename, duplicate, delete and download (#218, #219). */
final class OutlineStoreManageTest extends TestCase {
	private Folder&MockObject $outlines;
	private OutlineStore $store;
	private OpmlCodec $codec;
	/** @var array<int, File&MockObject> */
	private array $byId = [];
	/** @var list<File&MockObject> */
	private array $listing = [];

	protected function setUp(): void {
		$root = $this->createMock(IRootFolder::class);
		$user = $this->createMock(Folder::class);
		$this->outlines = $this->createMock(Folder::class);
		$root->method('getUserFolder')->with('alice')->willReturn($user);
		$user->method('nodeExists')->with('Outlines')->willReturn(true);
		$user->method('get')->with('Outlines')->willReturn($this->outlines);
		$this->outlines->method('getPath')->willReturn('/alice/files/Outlines');
		$this->outlines->method('getById')->willReturnCallback(fn (int $id): array => isset($this->byId[$id]) ? [$this->byId[$id]] : []);
		$this->outlines->method('getDirectoryListing')->willReturnCallback(fn (): array => $this->listing);
		$this->codec = new OpmlCodec();
		$this->store = new OutlineStore($root, $this->codec, new FakeLockingProvider());
	}

	/** @return File&MockObject */
	private function file(int $id, string $name, string $title = 'Old'): File {
		$file = $this->createMock(File::class);
		$state = (object)['name' => $name, 'content' => $this->codec->write(new Outline($title, [new Row('r1', 'Item', '')]))];
		$file->method('getId')->willReturn($id);
		$file->method('getName')->willReturnCallback(static fn (): string => $state->name);
		$file->method('getEtag')->willReturnCallback(static fn (): string => md5($state->name . $state->content));
		$file->method('getPath')->willReturnCallback(static fn (): string => '/alice/files/Outlines/' . $state->name);
		$file->method('getContent')->willReturnCallback(static fn (): string => $state->content);
		$file->method('putContent')->willReturnCallback(static function (string $c) use ($state): void {
			$state->content = $c;
		});
		$file->method('move')->willReturnCallback(static function (string $to) use ($state, $file): File {
			$state->name = basename($to);
			return $file;
		});
		$this->byId[$id] = $file;
		$this->listing[] = $file;
		return $file;
	}

	public function testRenameMovesTheFileAndSetsTheTitle(): void {
		$file = $this->file(10, 'Untitled.opml', 'Untitled');
		$file->expects($this->once())->method('move')->with('/alice/files/Outlines/Trip plan.opml');

		$result = $this->store->rename('alice', 10, '  Trip plan ');

		$this->assertSame(10, $result['fileId']);
		$this->assertSame('Trip plan.opml', $result['name']);
		$this->assertSame('Trip plan', $this->codec->parse($file->getContent())->title);
		$this->assertSame('Item', $this->codec->parse($file->getContent())->rows[0]->text);
		$this->assertSame($file->getEtag(), $result['etag']);
	}

	public function testRenameToATakenNameAddsANumber(): void {
		$this->file(10, 'Untitled.opml');
		$this->file(11, 'Plan.opml');

		$this->assertSame('Plan (2).opml', $this->store->rename('alice', 10, 'Plan')['name']);
	}

	public function testRenameChangingOnlyCaseKeepsItsSlot(): void {
		$this->file(10, 'plan.opml');

		$this->assertSame('Plan.opml', $this->store->rename('alice', 10, 'Plan')['name']);
	}

	public function testRenameToTheSameNameOnlyFixesTheTitle(): void {
		$file = $this->file(10, 'Plan.opml', 'Something else');
		$file->expects($this->never())->method('move');

		$this->store->rename('alice', 10, 'Plan');

		$this->assertSame('Plan', $this->codec->parse($file->getContent())->title);
	}

	public function testRenameRefusesForbiddenCharacters(): void {
		$this->file(10, 'Plan.opml');
		$this->expectException(\InvalidArgumentException::class);
		$this->store->rename('alice', 10, 'a/b');
	}

	public function testRenameWhileASaveHoldsTheLockIsAConflict(): void {
		$root = $this->createMock(IRootFolder::class);
		$user = $this->createMock(Folder::class);
		$root->method('getUserFolder')->willReturn($user);
		$user->method('nodeExists')->willReturn(true);
		$user->method('get')->willReturn($this->outlines);
		$locks = new FakeLockingProvider();
		$locks->held['nc_outliner/save/10'] = 2;
		$store = new OutlineStore($root, $this->codec, $locks);
		$this->file(10, 'Plan.opml');

		$this->expectException(ConflictException::class);
		$store->rename('alice', 10, 'Other');
	}

	public function testDuplicateWritesACopyWithAMatchingTitle(): void {
		$this->file(10, 'Plan.opml', 'Plan');
		$copy = $this->createMock(File::class);
		$copy->method('getId')->willReturn(20);
		$copy->method('getName')->willReturn('Plan (copy).opml');
		$copy->method('getEtag')->willReturn('e20');
		$written = null;
		$copy->method('putContent')->willReturnCallback(static function (string $c) use (&$written): void {
			$written = $c;
		});
		$this->outlines->expects($this->once())->method('newFile')->with('Plan (copy).opml')->willReturn($copy);

		$result = $this->store->duplicate('alice', 10);

		$this->assertSame(['fileId' => 20, 'name' => 'Plan (copy).opml', 'etag' => 'e20'], $result);
		$parsed = $this->codec->parse((string)$written);
		$this->assertSame('Plan (copy)', $parsed->title);
		$this->assertSame('Item', $parsed->rows[0]->text);
	}

	public function testDeleteDeletesTheOutlineFile(): void {
		$file = $this->file(10, 'Plan.opml');
		$file->expects($this->once())->method('delete');

		$this->store->delete('alice', 10);
	}

	public function testDeleteOfAnUnknownIdIsNotFound(): void {
		$this->expectException(NotFoundException::class);
		$this->store->delete('alice', 99);
	}

	public function testDownloadReturnsTheStoredFile(): void {
		$file = $this->file(10, 'Plan.opml', 'Plan');

		$this->assertSame(['name' => 'Plan.opml', 'content' => $file->getContent()], $this->store->download('alice', 10));
	}
}
