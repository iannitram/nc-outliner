<?php
declare(strict_types=1);

require __DIR__ . '/assert.php';

$routes = require __DIR__ . '/../../appinfo/routes.php';
$routes = $routes['routes'];
$find = static function (string $name, string $verb) use ($routes): array {
    foreach ($routes as $route) {
        if ($route['name'] === $name && $route['verb'] === $verb) {
            return $route;
        }
    }
    throw new RuntimeException('route not found');
};

check('page route remains first and list route exists', function () use ($routes, $find): void {
    same('page#index', $routes[0]['name']);
    $route = $find('outline#index', 'GET');
    same('/api/outlines', $route['url']);
});
check('create route exists', function () use ($find): void {
    $route = $find('outline#create', 'POST');
    same('/api/outlines', $route['url']);
});
check('show route exists', function () use ($find): void {
    $route = $find('outline#show', 'GET');
    same('/api/outlines/{name}', $route['url']);
});
