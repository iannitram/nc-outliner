<?php

declare(strict_types=1);

namespace OCA\NcOutliner\AppInfo;

use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\OutlineStore;
use OCP\AppFramework\App;
use OCP\AppFramework\Bootstrap\IBootContext;
use OCP\AppFramework\Bootstrap\IBootstrap;
use OCP\AppFramework\Bootstrap\IRegistrationContext;

class Application extends App implements IBootstrap {
	public const APP_ID = 'nc_outliner';

	public function __construct() {
		parent::__construct(self::APP_ID);
	}

	public function register(IRegistrationContext $context): void {
		$context->registerServiceAlias(IOutlineStore::class, OutlineStore::class);
	}

	public function boot(IBootContext $context): void {
	}
}
