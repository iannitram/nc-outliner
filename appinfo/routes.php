<?php
declare(strict_types=1);

return [
    'routes' => [
        ['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
        ['name' => 'theme#show', 'url' => '/api/theme', 'verb' => 'GET'],
        ['name' => 'theme#update', 'url' => '/api/theme', 'verb' => 'PUT'],
        ['name' => 'outline#index', 'url' => '/api/outlines', 'verb' => 'GET'],
        ['name' => 'outline#create', 'url' => '/api/outlines', 'verb' => 'POST'],
        ['name' => 'outline#recent', 'url' => '/api/outlines-recent', 'verb' => 'GET'],
        ['name' => 'outline#relocate', 'url' => '/api/outlines/{name}/relocate', 'verb' => 'POST', 'requirements' => ['name' => '.+']],
        ['name' => 'outline#show', 'url' => '/api/outlines/{name}', 'verb' => 'GET', 'requirements' => ['name' => '.+']],
        ['name' => 'outline#copy', 'url' => '/api/outlines/{name}/copy', 'verb' => 'POST', 'requirements' => ['name' => '.+']],
        ['name' => 'outline#update', 'url' => '/api/outlines/{name}', 'verb' => 'PUT', 'requirements' => ['name' => '.+']],
        ['name' => 'outline#export', 'url' => '/api/outlines/{name}/export', 'verb' => 'POST', 'requirements' => ['name' => '.+']],
    ],
];
