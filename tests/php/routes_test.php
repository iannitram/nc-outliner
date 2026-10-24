<?php
declare(strict_types=1);

require __DIR__ . '/assert.php';

$r = require __DIR__ . '/../../appinfo/routes.php';

check('routes is an array', function () use ($r): void {
    same(true, is_array($r['routes']));
});

check('page route is declared', function () use ($r): void {
    same(['name' => 'page#index', 'url' => '/', 'verb' => 'GET'], $r['routes'][0]);
});
