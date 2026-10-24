<?php
declare(strict_types=1);

return [
    'routes' => [
        ['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
        ['name' => 'outline#index', 'url' => '/api/outlines', 'verb' => 'GET'],
        ['name' => 'outline#create', 'url' => '/api/outlines', 'verb' => 'POST'],
        ['name' => 'outline#show', 'url' => '/api/outlines/{name}', 'verb' => 'GET'],
        ['name' => 'outline#copy', 'url' => '/api/outlines/{name}/copy', 'verb' => 'POST'],
        ['name' => 'outline#update', 'url' => '/api/outlines/{name}', 'verb' => 'PUT'],
    ],
];
