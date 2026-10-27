<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Odt;

/**
 * Zips a content.xml with mimetype, META-INF/manifest.xml and fixed light styles.xml into .odt bytes.
 * Pure apart from a temporary file.
 * See CODEMAP.md, "ODT package" and SPEC.md M7, M12.
 */
final class OdtPackage {
	private const MIMETYPE = 'application/vnd.oasis.opendocument.text';

	/**
	 * @param (\Closure(string): void)|null $archiveHook For testing error handling during archive creation
	 */
	public function build(string $contentXml, ?\Closure $archiveHook = null): string {
		$tempFile = tempnam(sys_get_temp_dir(), 'nco');
		if ($tempFile === false) {
			throw new \RuntimeException('Failed to create temporary file for ODT package');
		}

		$zip = null;
		try {
			$zip = new \ZipArchive();
			$status = $zip->open($tempFile, \ZipArchive::CREATE | \ZipArchive::OVERWRITE);
			if ($status !== true) {
				throw new \RuntimeException('Failed to open ZIP archive: ' . $status);
			}

			// mimetype must be the first entry, stored uncompressed
			$zip->addFromString('mimetype', self::MIMETYPE);
			$zip->setCompressionName('mimetype', \ZipArchive::CM_STORE);

			$zip->addFromString('META-INF/manifest.xml', $this->manifestXml());
			$zip->addFromString('styles.xml', $this->stylesXml());
			$zip->addFromString('content.xml', $contentXml);

			if ($archiveHook !== null) {
				$archiveHook($tempFile);
			}

			if (!$zip->close()) {
				throw new \RuntimeException('Failed to close ZIP archive');
			}
			$zip = null;

			$bytes = file_get_contents($tempFile);
			if ($bytes === false) {
				throw new \RuntimeException('Failed to read ODT package from temporary file');
			}

			return $bytes;
		} catch (\Throwable $e) {
			if ($zip instanceof \ZipArchive) {
				try {
					$zip->unchangeAll();
					$zip->close();
				} catch (\Throwable) {
				}
				$zip = null;
			}
			throw $e;
		} finally {
			$zip = null;
			if (file_exists($tempFile)) {
				unlink($tempFile);
			}
		}
	}

	private function manifestXml(): string {
		$xml = new \XMLWriter();
		$xml->openMemory();
		$xml->startDocument('1.0', 'UTF-8');
		$xml->startElementNS('manifest', 'manifest', 'urn:oasis:names:tc:opendocument:xmlns:manifest:1.0');
		$xml->writeAttribute('manifest:version', '1.2');

		$this->writeManifestEntry($xml, '/', self::MIMETYPE, '1.2');
		$this->writeManifestEntry($xml, 'content.xml', 'text/xml');
		$this->writeManifestEntry($xml, 'styles.xml', 'text/xml');

		$xml->endElement(); // manifest:manifest
		$xml->endDocument();
		return $xml->outputMemory();
	}

	private function writeManifestEntry(\XMLWriter $xml, string $path, string $mediaType, ?string $version = null): void {
		$xml->startElement('manifest:file-entry');
		$xml->writeAttribute('manifest:full-path', $path);
		if ($version !== null) {
			$xml->writeAttribute('manifest:version', $version);
		}
		$xml->writeAttribute('manifest:media-type', $mediaType);
		$xml->endElement();
	}

	private function stylesXml(): string {
		$xml = new \XMLWriter();
		$xml->openMemory();
		$xml->startDocument('1.0', 'UTF-8');
		$xml->startElementNS('office', 'document-styles', 'urn:oasis:names:tc:opendocument:xmlns:office:1.0');
		$xml->writeAttribute('office:version', '1.2');
		$xml->writeAttribute('xmlns:style', 'urn:oasis:names:tc:opendocument:xmlns:style:1.0');
		$xml->writeAttribute('xmlns:text', 'urn:oasis:names:tc:opendocument:xmlns:text:1.0');
		$xml->writeAttribute('xmlns:fo', 'urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0');

		$xml->startElement('office:styles');
		$this->writeParagraphStyle($xml, 'Heading_20_1', 'Heading 1', '18pt', 'bold', 'Text_20_body', 1);
		$this->writeParagraphStyle($xml, 'Heading_20_2', 'Heading 2', '14pt', 'bold', 'Text_20_body', 2);
		$this->writeParagraphStyle($xml, 'Text_20_body', 'Text body', '11pt');
		$xml->endElement(); // office:styles

		$xml->startElement('office:automatic-styles');
		$xml->startElement('style:page-layout');
		$xml->writeAttribute('style:name', 'PageLayout');
		$xml->startElement('style:page-layout-properties');
		$xml->writeAttribute('fo:background-color', '#ffffff');
		$xml->endElement();
		$xml->endElement();
		$xml->endElement(); // office:automatic-styles

		$xml->startElement('office:master-styles');
		$xml->startElement('style:master-page');
		$xml->writeAttribute('style:name', 'Standard');
		$xml->writeAttribute('style:page-layout-name', 'PageLayout');
		$xml->endElement();
		$xml->endElement(); // office:master-styles

		$xml->endElement(); // office:document-styles
		$xml->endDocument();
		return $xml->outputMemory();
	}

	private function writeParagraphStyle(
		\XMLWriter $xml,
		string $name,
		string $displayName,
		string $fontSize,
		?string $fontWeight = null,
		?string $nextStyle = null,
		?int $outlineLevel = null,
	): void {
		$xml->startElement('style:style');
		$xml->writeAttribute('style:name', $name);
		$xml->writeAttribute('style:display-name', $displayName);
		$xml->writeAttribute('style:family', 'paragraph');
		if ($nextStyle !== null) {
			$xml->writeAttribute('style:next-style-name', $nextStyle);
		}
		if ($outlineLevel !== null) {
			$xml->writeAttribute('style:default-outline-level', (string)$outlineLevel);
		}

		$xml->startElement('style:paragraph-properties');
		$xml->writeAttribute('fo:background-color', '#ffffff');
		$xml->endElement();

		$xml->startElement('style:text-properties');
		$xml->writeAttribute('fo:color', '#000000');
		$xml->writeAttribute('fo:font-size', $fontSize);
		if ($fontWeight !== null) {
			$xml->writeAttribute('fo:font-weight', $fontWeight);
		}
		$xml->endElement();

		$xml->endElement(); // style:style
	}
}
