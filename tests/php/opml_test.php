<?php
declare(strict_types=1);
require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/Opml.php';
use OCA\Outliner\Service\Opml;
$codec = new Opml();
check('create and read preserve title safely', function () use ($codec): void {
    same(['title' => 'A & <B>', 'rows' => []], $codec->read($codec->create('A & <B>')));
});
check('nested rows, IDs and collapse state round trip', function () use ($codec): void {
    $doc = ['title' => 'Test', 'rows' => [['id' => 'a', 'text' => 'Parent & <safe>', 'collapsed' => true, 'children' => [['id' => 'b', 'text' => 'Child', 'collapsed' => false, 'children' => []]]]]];
    same($doc, $codec->read($codec->write($doc, $codec->create('Old'))));
});
check('editing keeps unknown metadata and namespaces', function () use ($codec): void {
    $xml = '<opml version="2.0" xmlns:x="urn:test"><head><title>Old</title><x:columns>schema</x:columns></head><body><outline text="Old" custom="value" x:style="bold"><x:rich>rich text</x:rich><outline text="child"/></outline></body></opml>';
    $doc = $codec->read($xml);
    $id = $doc['rows'][0]['id'];
    $doc['rows'][0]['text'] = 'New';
    $out = $codec->write($doc, $xml);
    same(true, str_contains($out, 'custom="value"'));
    same(true, str_contains($out, 'x:style="bold"'));
    same(true, str_contains($out, '<x:rich>rich text</x:rich>'));
    same(true, str_contains($out, '<x:columns>schema</x:columns>'));
    same($id, $codec->read($out)['rows'][0]['id']);
});
check('moving a row retains its extension data', function () use ($codec): void {
    $xml = '<opml><body><outline text="one" custom="retained"/><outline text="two"/></body></opml>';
    $doc = $codec->read($xml);
    $moved = array_shift($doc['rows']);
    $doc['rows'][0]['children'][] = $moved;
    $out = $codec->write($doc, $xml);
    same(true, str_contains($out, 'custom="retained"'));
    same('one', $codec->read($out)['rows'][0]['children'][0]['text']);
});
check('malformed XML and external entities are rejected', function () use ($codec): void {
    foreach (['<opml>', '<no/>', '<!DOCTYPE opml [<!ENTITY a SYSTEM "file:///etc/passwd">]><opml><body/></opml>', '<opml/>'] as $xml) {
        try { $codec->read($xml); throw new RuntimeException('Accepted invalid XML'); }
        catch (InvalidArgumentException) {}
    }
});
check('invalid and duplicate IDs are rejected', function () use ($codec): void {
    foreach (['bad id', 'same'] as $id) {
        $row = ['id' => $id, 'text' => 'test', 'children' => []];
        try { $codec->write(['title' => '', 'rows' => [$row, $row]], $codec->create('')); throw new RuntimeException('Accepted invalid rows'); }
        catch (InvalidArgumentException) {}
    }
});
