<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Odt;

use OCA\NcOutliner\Odt\OdtPackage;
use PHPUnit\Framework\TestCase;

final class OdtPackageTest extends TestCase {
	private const OFFICE_NS = 'urn:oasis:names:tc:opendocument:xmlns:office:1.0';
	private const STYLE_NS = 'urn:oasis:names:tc:opendocument:xmlns:style:1.0';
	private const MANIFEST_NS = 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0';
	private const FO_NS = 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0';

	public function testMimetypeIsFirstEntryStoredUncompressed(): void {
		$bytes = (new OdtPackage())->build('<office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"/>');
		$this->assertPackage($bytes, static function (\ZipArchive $zip): void {
			self::assertGreaterThanOrEqual(1, $zip->numFiles);
			self::assertSame('mimetype', $zip->getNameIndex(0));

			$stat = $zip->statIndex(0);
			self::assertIsArray($stat);
			self::assertSame(\ZipArchive::CM_STORE, $stat['comp_method']);

			$content = $zip->getFromIndex(0);
			self::assertSame('application/vnd.oasis.opendocument.text', $content);
		});
	}

	public function testContentXmlIsByteIdenticalToInput(): void {
		$contentXml = '<?xml version="1.0" encoding="UTF-8"?><office:document-content xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0"><office:body><office:text><text:p>Hello &amp; World</text:p></office:text></office:body></office:document-content>';
		$bytes = (new OdtPackage())->build($contentXml);
		$this->assertPackage($bytes, static function (\ZipArchive $zip) use ($contentXml): void {
			$extracted = $zip->getFromName('content.xml');
			self::assertSame($contentXml, $extracted);
		});
	}

	public function testManifestListsContentXmlAndStylesXml(): void {
		$bytes = (new OdtPackage())->build('<sample/>');
		$this->assertPackage($bytes, static function (\ZipArchive $zip): void {
			$manifestXml = $zip->getFromName('META-INF/manifest.xml');
			self::assertIsString($manifestXml);

			$doc = new \DOMDocument();
			self::assertTrue($doc->loadXML($manifestXml));

			$xpath = new \DOMXPath($doc);
			$xpath->registerNamespace('manifest', self::MANIFEST_NS);

			$contentEntry = $xpath->query('//manifest:file-entry[@manifest:full-path="content.xml"]');
			self::assertSame(1, $contentEntry->length);
			self::assertSame('text/xml', $xpath->evaluate('string(//manifest:file-entry[@manifest:full-path="content.xml"]/@manifest:media-type)'));

			$stylesEntry = $xpath->query('//manifest:file-entry[@manifest:full-path="styles.xml"]');
			self::assertSame(1, $stylesEntry->length);
			self::assertSame('text/xml', $xpath->evaluate('string(//manifest:file-entry[@manifest:full-path="styles.xml"]/@manifest:media-type)'));
		});
	}

	public function testStylesDefinesHeading1Heading2AndTextBodyInBlackOnWhite(): void {
		$bytes = (new OdtPackage())->build('<sample/>');
		$this->assertPackage($bytes, static function (\ZipArchive $zip): void {
			$stylesXml = $zip->getFromName('styles.xml');
			self::assertIsString($stylesXml);

			$doc = new \DOMDocument();
			self::assertTrue($doc->loadXML($stylesXml));

			$xpath = new \DOMXPath($doc);
			$xpath->registerNamespace('office', self::OFFICE_NS);
			$xpath->registerNamespace('style', self::STYLE_NS);
			$xpath->registerNamespace('fo', self::FO_NS);

			foreach (['Heading_20_1', 'Heading_20_2', 'Text_20_body'] as $styleName) {
				$style = $xpath->query('//style:style[@style:name="' . $styleName . '"]');
				self::assertSame(1, $style->length, 'Missing style: ' . $styleName);
				self::assertSame(
					'paragraph',
					$xpath->evaluate('string(//style:style[@style:name="' . $styleName . '"]/@style:family)'),
				);
				self::assertSame(
					'#000000',
					$xpath->evaluate('string(//style:style[@style:name="' . $styleName . '"]/style:text-properties/@fo:color)'),
					'Text color must be black for ' . $styleName,
				);
				self::assertSame(
					'#ffffff',
					$xpath->evaluate('string(//style:style[@style:name="' . $styleName . '"]/style:paragraph-properties/@fo:background-color)'),
					'Background color must be white for ' . $styleName,
				);
			}
		});
	}

	public function testRemovesTempFileWhenZippingThrows(): void {
		$recordedTempFile = null;
		$package = new OdtPackage();

		try {
			$package->build('<sample/>', static function (string $tempFile) use (&$recordedTempFile): void {
				$recordedTempFile = $tempFile;
				self::assertFileExists($tempFile);
				throw new \RuntimeException('Zipping failed unexpectedly');
			});
			self::fail('Expected exception to be thrown');
		} catch (\RuntimeException $e) {
			self::assertSame('Zipping failed unexpectedly', $e->getMessage());
		}

		self::assertNotNull($recordedTempFile);
		clearstatcache(true, $recordedTempFile);
		self::assertFileDoesNotExist($recordedTempFile);
	}

	public function testRemovesTempFileOnSuccessfulBuild(): void {
		$recordedTempFile = null;
		$package = new OdtPackage();

		$bytes = $package->build('<sample/>', static function (string $tempFile) use (&$recordedTempFile): void {
			$recordedTempFile = $tempFile;
			self::assertFileExists($tempFile);
		});

		self::assertNotEmpty($bytes);
		self::assertNotNull($recordedTempFile);
		clearstatcache(true, $recordedTempFile);
		self::assertFileDoesNotExist($recordedTempFile);
	}

	/**
	 * @param callable(\ZipArchive): void $assert
	 */
	private function assertPackage(string $bytes, callable $assert): void {
		$tempFile = tempnam(sys_get_temp_dir(), 'nco_test');
		if ($tempFile === false) {
			self::fail('Failed to create temporary file for reading test package');
		}

		$writeResult = file_put_contents($tempFile, $bytes);
		self::assertNotFalse($writeResult, 'Failed to write package bytes to temp file');

		$zip = new \ZipArchive();
		try {
			$result = $zip->open($tempFile);
			self::assertTrue($result === true, 'ZipArchive failed to open package: ' . $result);
			$assert($zip);
		} finally {
			$zip->close();
			if (file_exists($tempFile)) {
				unlink($tempFile);
			}
		}
	}
}
