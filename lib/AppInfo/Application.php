<?php

declare(strict_types=1);

namespace OCA\NcOutliner\AppInfo;

use OCP\AppFramework\App;

class Application extends App {
	public const APP_ID = 'nc_outliner';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}
}
