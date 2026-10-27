<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\AppInfo;

use OCA\NcOutliner\AppInfo\Application;
use OCA\NcOutliner\Service\IOutlineStore;
use OCA\NcOutliner\Service\OutlineStore;
use OCP\AppFramework\Bootstrap\IRegistrationContext;
use PHPUnit\Framework\TestCase;

// No need to construct App, which accesses the global server.
final class ApplicationTest extends TestCase {
	public function testRegisterAliasesOutlineStoreInterface(): void {
		$context = $this->createMock(IRegistrationContext::class);
		$context->expects($this->once())
			->method('registerServiceAlias')
			->with(IOutlineStore::class, OutlineStore::class);

		$app = (new \ReflectionClass(Application::class))->newInstanceWithoutConstructor();
		$app->register($context);
	}
}
