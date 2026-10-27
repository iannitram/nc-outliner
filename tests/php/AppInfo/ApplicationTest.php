<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\AppInfo;

use OCA\NcOutliner\AppInfo\Application;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\OutlineStore;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use PHPUnit\Framework\TestCase;

require_once __DIR__ . '/../../stubs/OC.php';
\OC::$server = new class {
	public function get(string $service): object {
		return new class {
			public function getSystemValueBool(string $name): bool {
				return false;
			}
		};
	}

	public function getRegisteredAppContainer(string $appId): object {
		return new class {
		};
	}
};

final class ApplicationTest extends TestCase {
	public function testRegisterAliasesOutlineStoreInterface(): void {
		$context = $this->createMock(IRegistrationContext::class);
		$context->expects($this->once())
			->method('registerServiceAlias')
			->with(IOutlineStore::class, OutlineStore::class);

		$app = new Application();
		$app->register($context);
	}
}
