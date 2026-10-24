<?php
declare(strict_types=1);
require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/Opml.php';
require __DIR__ . '/../../lib/Odt/OdtBuilder.php';
use OCA\Outliner\Service\Opml;
use OCA\Outliner\Odt\OdtBuilder;
$codec = new Opml();
check('all numbering styles and suffixes round trip with unknown XML', function () use ($codec): void {
    $xml = '<opml xmlns:x="urn:extra" x:custom="safe"><head><title>Plan</title></head><body><outline text="A" x:style="blue"><outline text="B"/></outline></body></opml>';
    foreach (['none', 'decimal', 'alpha', 'roman', 'section'] as $style) foreach (['.', ')', ':', ''] as $suffix) {
        $doc = $codec->read($xml);
        $doc['numbering'] = ['style' => $style, 'suffix' => $suffix];
        $saved = $codec->write($doc, $xml);
        same($doc, $codec->read($saved));
        same(true, str_contains($saved, 'x:custom="safe"'));
        same(true, str_contains($saved, 'x:style="blue"'));
    }
    same(false, array_key_exists('numbering', $codec->read($xml)));
});
check('numbering rejects invalid settings without changing source', function () use ($codec): void {
    foreach ([null, 'decimal', [], ['style' => 'unknown', 'suffix' => '.'], ['style' => 'alpha', 'suffix' => '<script>'], ['style' => 'roman', 'suffix' => false]] as $settings) {
        $doc = ['title' => 'Plan', 'rows' => [], 'numbering' => $settings];
        try { $codec->write($doc, $codec->create('Plan')); throw new RuntimeException('Invalid numbering accepted'); }
        catch (InvalidArgumentException) {}
    }
});
check('reopened document numbering reaches generated ODT including headings and nested rows', function () use ($codec): void {
    $rows = [['id' => 'a', 'text' => 'A & B', 'children' => [['id' => 'b', 'text' => 'Child', 'children' => [['id' => 'c', 'text' => 'Deep', 'children' => []]]]]], ['id' => 'd', 'text' => 'Other', 'children' => []]];
    foreach (['decimal' => '1', 'alpha' => 'a', 'roman' => 'i', 'section' => '1.1.1'] as $style => $deep) {
        $doc = ['title' => 'Plan', 'rows' => $rows, 'numbering' => ['style' => $style, 'suffix' => ')']];
        $reopened = $codec->read($codec->write($doc, $codec->create('Plan')));
        $path = tempnam(sys_get_temp_dir(), 'numbering');
        file_put_contents($path, OdtBuilder::buildDocument($reopened));
        $zip = new ZipArchive(); same(true, $zip->open($path));
        $content = $zip->getFromName('content.xml');
        same(true, (new DOMDocument())->loadXML($content));
        same(true, str_contains($content, $deep . ') Deep'));
        same(true, str_contains($content, 'text:style-name="NumberedRows"'));
        same(false, str_contains($content, 'text:style-name="Bullets"'));
        same(true, str_contains($content, 'A &amp; B'));
        same(true, str_contains($zip->getFromName('styles.xml'), 'style:name="NumberedRows"'));
        $zip->close(); unlink($path);
        same('A & B', $doc['rows'][0]['text']);
    }
});
