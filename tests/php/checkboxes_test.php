<?php
declare(strict_types=1);
require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/Opml.php';
use OCA\Outliner\Service\Opml;
$codec = new Opml();
check('checklist visibility and nested statuses survive save reopen and hiding', function () use ($codec): void {
    $doc = ['title' => 'Tasks', 'rows' => [
        ['id' => 'a', 'text' => 'Parent', 'collapsed' => false, 'children' => [
            ['id' => 'b', 'text' => 'Child', 'collapsed' => false, 'children' => [], 'checked' => false],
        ], 'checked' => true],
    ], 'showCheckboxes' => true];
    $xml = $codec->write($doc, $codec->create('Old'));
    same($doc, $codec->read($xml));
    $doc['showCheckboxes'] = false;
    same($doc, $codec->read($codec->write($doc, $xml)));
});
check('checklist updates preserve unrelated XML attributes and reject nonboolean state', function () use ($codec): void {
    $xml = '<opml xmlns:x="urn:extension"><head><title>Tasks</title></head><body><outline text="Task" x:style="blue"/></body></opml>';
    $doc = $codec->read($xml);
    $doc['showCheckboxes'] = true;
    $doc['rows'][0]['checked'] = true;
    $saved = $codec->write($doc, $xml);
    same(true, str_contains($saved, 'x:style="blue"'));
    foreach (['showCheckboxes', 'checked'] as $field) {
        $invalid = $doc;
        if ($field === 'checked') $invalid['rows'][0]['checked'] = 'false';
        else $invalid['showCheckboxes'] = 'false';
        try { $codec->write($invalid, $xml); throw new RuntimeException('Invalid checkbox accepted'); }
        catch (InvalidArgumentException) {}
    }
});
