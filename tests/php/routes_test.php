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

check('template list, save and instantiate routes are declared', function () use ($r): void {
    $routes = array_column($r['routes'], null, 'name');
    same(['name' => 'outline#templates', 'url' => '/api/templates', 'verb' => 'GET'], $routes['outline#templates']);
    same(['name' => 'outline#saveTemplate', 'url' => '/api/templates', 'verb' => 'POST'], $routes['outline#saveTemplate']);
    same(['name' => 'outline#fromTemplate', 'url' => '/api/templates/{name}/outlines', 'verb' => 'POST'], $routes['outline#fromTemplate']);
});
