<?php
declare(strict_types=1);
require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/Opml.php';
use OCA\Outliner\Service\Opml;
$codec = new Opml();
function richDoc(): array {
    return ['title' => 'Rich', 'rows' => [['id' => 'a', 'text' => 'A😀 <script>', 'collapsed' => false, 'children' => [], 'note' => "Notes & <img>\nsecond",
        'textFormats' => [['start' => 1, 'end' => 3, 'marks' => ['bold', 'italic']]],
        'noteFormats' => [['start' => 0, 'end' => 5, 'marks' => ['underline', 'strikethrough']]]]]];
}
check('topic and note formats round trip as inert annotations with UTF-16 offsets', function () use ($codec): void {
    $doc = richDoc();
    $xml = $codec->write($doc, $codec->create(''));
    same($doc, $codec->read($xml));
    same(false, str_contains($xml, '<script>'));
    same(false, str_contains($xml, '<img>'));
    same(true, str_contains($xml, 'nc:text-formats='));
    same(true, str_contains($xml, 'nc:note-formats='));
});
check('clearing annotations persists while foreign metadata and child XML survive', function () use ($codec): void {
    $xml = '<opml xmlns:nc="https://nextcloud.com/ns/outliner/1" xmlns:x="urn:test"><head><title>Old</title><x:style>keep</x:style></head><body><outline text="old" nc:id="a" x:color="red"><x:rich>keep</x:rich></outline></body></opml>';
    $doc = richDoc();
    $xml = $codec->write($doc, $xml);
    $doc['rows'][0]['textFormats'] = [];
    $doc['rows'][0]['noteFormats'] = [];
    $xml = $codec->write($doc, $xml);
    same($doc, $codec->read($xml));
    same(true, str_contains($xml, 'x:color="red"'));
    same(true, str_contains($xml, '<x:rich>keep</x:rich>'));
    same(true, str_contains($xml, '<x:style>keep</x:style>'));
    unset($doc['rows'][0]['textFormats'], $doc['rows'][0]['noteFormats']);
    $doc['rows'][0]['text'] = '';
    same($doc, $codec->read($codec->write($doc, $xml)));
});
check('malformed, overlapping, out of bounds and executable rich annotations are rejected', function () use ($codec): void {
    $invalid = [null, 'html', ['start' => 0], [['start' => -1, 'end' => 1, 'marks' => ['bold']]],
        [['start' => 0, 'end' => 100, 'marks' => ['bold']]], [['start' => 0, 'end' => 1.5, 'marks' => ['bold']]],
        [['start' => 0, 'end' => 1, 'marks' => ['<script>']]], [['start' => 0, 'end' => 1, 'marks' => ['bold', 'bold']]],
        [['start' => 0, 'end' => 1, 'marks' => ['bold'], 'html' => '<img>']],
        [['start' => 0, 'end' => 2, 'marks' => ['bold']], ['start' => 1, 'end' => 3, 'marks' => ['italic']]]];
    foreach ($invalid as $ranges) {
        foreach (['textFormats', 'noteFormats'] as $field) {
            $doc = richDoc();
            $doc['rows'][0][$field] = $ranges;
            try { $codec->write($doc, $codec->create('')); throw new RuntimeException('Accepted unsafe annotations'); }
            catch (InvalidArgumentException) {}
        }
    }
});
check('hostile or malformed stored annotation JSON is rejected on read', function () use ($codec): void {
    foreach (['invalid json', '{"html":"<img>"}', '[{"start":0,"end":1,"marks":["script"]}]'] as $json) {
        $xml = '<opml xmlns:nc="https://nextcloud.com/ns/outliner/1"><body><outline text="safe" nc:text-formats="' . htmlspecialchars($json, ENT_QUOTES | ENT_XML1) . '"/></body></opml>';
        try { $codec->read($xml); throw new RuntimeException('Accepted unsafe stored annotations'); }
        catch (InvalidArgumentException) {}
    }
});
