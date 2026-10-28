<?php
declare(strict_types=1);

return [
	'routes' => [
		['name' => 'bug_report#relay', 'url' => '/api/bugreport', 'verb' => 'POST'],
		['name' => 'admin#save', 'url' => '/api/admin/bugreport', 'verb' => 'POST'],
		['name' => 'outline#export', 'url' => '/api/outline-opml', 'verb' => 'POST'],
		['name' => 'page#index', 'url' => '/', 'verb' => 'GET'],
		['name' => 'outline#index', 'url' => '/api/outlines', 'verb' => 'GET'],
		['name' => 'outline#create', 'url' => '/api/outlines', 'verb' => 'POST'],
		['name' => 'outline#show', 'url' => '/api/outlines/{fileId}', 'verb' => 'GET'],
		['name' => 'outline#update', 'url' => '/api/outlines/{fileId}', 'verb' => 'PUT'],
		['name' => 'outline#copy', 'url' => '/api/outlines/{fileId}/copy', 'verb' => 'POST'],
		['name' => 'publish#publish', 'url' => '/api/outlines/{fileId}/publish', 'verb' => 'POST'],
		['name' => 'settings#get', 'url' => '/api/settings', 'verb' => 'GET'],
		['name' => 'settings#set', 'url' => '/api/settings', 'verb' => 'PUT'],
	],
];
