<?php
declare(strict_types=1);

return [
	'routes' => [
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
		['name' => 'outline#index', 'url' => '/api/outlines', 'verb' => 'GET'],
		['name' => 'outline#create', 'url' => '/api/outlines', 'verb' => 'POST'],
		['name' => 'outline#show', 'url' => '/api/outlines/{fileId}', 'verb' => 'GET'],
		['name' => 'outline#update', 'url' => '/api/outlines/{fileId}', 'verb' => 'PUT'],
		['name' => 'outline#copy', 'url' => '/api/outlines/{fileId}/copy', 'verb' => 'POST'],
	],
];
