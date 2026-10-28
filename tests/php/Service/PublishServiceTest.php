<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Service;

use OCA\NcOutliner\Odt\ContentWriter;
use OCA\NcOutliner\Odt\OdtPackage;
use OCA\NcOutliner\Opml\Outline;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\PublishService;
use OCP\Files\File;
use OCP\Files\Folder;
use OCP\Files\IRootFolder;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class PublishServiceTest extends TestCase {
	private function service(Folder $userFolder, IOutlineStore $store): PublishService {
		$root = $this->createMock(IRootFolder::class);
		$root->method('getUserFolder')->with('alice')->willReturn($userFolder);
		$store->method('read')->with('alice', 7)->willReturn([
			'fileId' => 7, 'name' => 'Plan.opml', 'etag' => 'e1', 'outline' => new Outline('Plan', []),
		]);
		return new PublishService($store, $root, new ContentWriter(), new OdtPackage());
	}

	public function testWritesValidOdtAndOverwritesExistingFile(): void {
		$user = $this->createMock(Folder::class);
		$destination = $this->createMock(Folder::class);
		$user->method('get')->with('Documents')->willReturn($destination);
		$user->method('getRelativePath')->willReturn('/Documents/Plan.odt');
		$destination->method('nodeExists')->with('Plan.odt')->willReturn(false, true);
		$file = $this->createMock(File::class);
		$file->method('getId')->willReturn(88);
		$file->method('getPath')->willReturn('/alice/files/Documents/Plan.odt');
		$destination->expects($this->once())->method('newFile')->with('Plan.odt', $this->callback(fn (string $bytes): bool => $this->hasOdtMimetype($bytes)))->willReturn($file);
		$destination->method('get')->with('Plan.odt')->willReturn($file);
		$file->expects($this->once())->method('putContent')->with($this->callback(fn (string $bytes): bool => $this->hasOdtMimetype($bytes)));
		$service = $this->service($user, $this->createMock(IOutlineStore::class));
		$this->assertSame(['fileId' => 88, 'path' => '/Documents/Plan.odt'], $service->publish('alice', 7, 'Documents', 'Plan'));
		$this->assertSame(['fileId' => 88, 'path' => '/Documents/Plan.odt'], $service->publish('alice', 7, 'Documents', 'Plan'));
	}

	private function hasOdtMimetype(string $bytes): bool {
		$temp = tempnam(sys_get_temp_dir(), 'nco-test');
		file_put_contents($temp, $bytes);
		$zip = new \ZipArchive();
		try {
			return $zip->open($temp) === true && $zip->getFromName('mimetype') === 'application/vnd.oasis.opendocument.text';
		} finally {
			$zip->close();
			unlink($temp);
		}
	}

	public function testRejectsTraversalAndNonFolderDestination(): void {
		$user = $this->createMock(Folder::class);
		$this->expectException(\InvalidArgumentException::class);
		$this->service($user, $this->createMock(IOutlineStore::class))->publish('alice', 7, 'A/../B', 'Plan');
	}

	public function testRejectsDestinationThatIsAFile(): void {
		$user = $this->createMock(Folder::class);
		$user->method('get')->willReturn($this->createMock(File::class));
		$this->expectException(\InvalidArgumentException::class);
		$this->service($user, $this->createMock(IOutlineStore::class))->publish('alice', 7, '', 'Plan');
	}

	/** @return array<string, array{string}> */
	public static function forbiddenNames(): array {
		return array_combine(['backslash','slash','colon','star','question','quote','less','greater','pipe'], array_map(static fn (string $c): array => ['Plan' . $c . 'x'], str_split('\\/:*?"<>|')));
	}

	#[DataProvider('forbiddenNames')]
	public function testRejectsForbiddenNameCharacters(string $name): void {
		$user = $this->createMock(Folder::class);
		$this->expectException(\InvalidArgumentException::class);
		$this->service($user, $this->createMock(IOutlineStore::class))->publish('alice', 7, '', $name);
	}

	/** @return array<string, array{string}> */
	public static function dotNames(): array {
		return ['single dot' => ['.'], 'double dot' => ['..']];
	}

	#[DataProvider('dotNames')]
	public function testRejectsDotAndDoubleDotAsWholeName(string $name): void {
		$user = $this->createMock(Folder::class);
		$user->method('get')->willReturn($this->createMock(Folder::class));
		$user->expects($this->never())->method('getRelativePath');
		$this->expectException(\InvalidArgumentException::class);
		$this->expectExceptionMessage('Invalid document name');
		$this->service($user, $this->createMock(IOutlineStore::class))->publish('alice', 7, '', $name);
	}

	/** @return array<string, array{string}> */
	public static function namesWithDots(): array {
		return ['notes.v2' => ['notes.v2'], 'a..b' => ['a..b'], 'three dots' => ['...']];
	}

	#[DataProvider('namesWithDots')]
	public function testLegitimateNamesContainingDotsStillPublish(string $name): void {
		$user = $this->createMock(Folder::class);
		$destination = $this->createMock(Folder::class);
		$user->method('get')->willReturn($destination);
		$user->method('getRelativePath')->willReturn('/' . $name . '.odt');
		$destination->method('nodeExists')->willReturn(false);
		$file = $this->createMock(File::class);
		$file->method('getId')->willReturn(5);
		$file->method('getPath')->willReturn('/alice/files/' . $name . '.odt');
		$destination->expects($this->once())->method('newFile')->with($name . '.odt', $this->isType('string'))->willReturn($file);
		$this->assertSame(['fileId' => 5, 'path' => '/' . $name . '.odt'], $this->service($user, $this->createMock(IOutlineStore::class))->publish('alice', 7, '', $name));
	}
}
