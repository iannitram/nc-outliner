<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\AdminController;
use OCA\NcOutliner\Settings\Admin;
use OCA\NcOutliner\Settings\AdminSection;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IURLGenerator;
use PHPUnit\Framework\TestCase;

final class AdminControllerTest extends TestCase {
	public function testSaveRequiresAdminLoginAndCsrf(): void {
		$method = new \ReflectionMethod(AdminController::class, 'save');
		foreach ([NoAdminRequired::class, NoCSRFRequired::class, PublicPage::class] as $attribute) {
			$this->assertSame([], $method->getAttributes($attribute));
		}
	}

	public function testSaveStoresTokenAsSensitiveAndDoesNotReturnIt(): void {
		$config = $this->createMock(IAppConfig::class);
		$saved = [];
		$config->expects($this->exactly(2))->method('setValueString')->willReturnCallback(function ($app, $key, $value, $lazy = false, $sensitive = false) use (&$saved): bool {
			$saved[$key] = [$value, $sensitive];
			return true;
		});
		$urls = $this->createMock(IURLGenerator::class);
		$urls->method('linkToRoute')->willReturn('/settings/admin/nc_outliner');
		$controller = new AdminController($this->createMock(IRequest::class), $config, $urls);
		$response = $controller->save('https://drop.example.invalid', 'TEST-TOKEN-123');
		$this->assertSame(['https://drop.example.invalid', false], $saved['bug_drop_base']);
		$this->assertSame(['TEST-TOKEN-123', true], $saved['bug_drop_token']);
		$this->assertSame('/settings/admin/nc_outliner', $response->getRedirectURL());
	}

	public function testAdminFormOnlyExposesTokenStatus(): void {
		$config = $this->createMock(IAppConfig::class);
		$config->method('getValueString')->willReturnMap([
			['nc_outliner', 'bug_drop_base', '', false, 'https://drop.example.invalid'],
			['nc_outliner', 'bug_drop_token', '', false, 'TEST-TOKEN-123'],
		]);
		$urls = $this->createMock(IURLGenerator::class);
		$urls->method('linkToRoute')->willReturn('/apps/nc_outliner/api/admin/bugreport');
		$params = (new Admin($config, $urls))->getForm()->getParams();
		$this->assertTrue($params['tokenSet']);
		$this->assertStringNotContainsString('TEST-TOKEN-123', json_encode($params));
		$this->assertSame('nc_outliner', (new AdminSection($urls))->getID());
		$this->assertSame('Outliner', (new AdminSection($urls))->getName());
	}

	public function testBlankTokenKeepsSavedSecret(): void {
		$config = $this->createMock(IAppConfig::class);
		$config->expects($this->once())->method('setValueString')->with('nc_outliner', 'bug_drop_base', '');
		$controller = new AdminController($this->createMock(IRequest::class), $config, $this->createMock(IURLGenerator::class));
		$controller->save();
	}

	public function testClearTokenIsExplicit(): void {
		$config = $this->createMock(IAppConfig::class);
		$config->expects($this->exactly(2))->method('setValueString')->willReturnCallback(function ($app, $key, $value, $lazy = false, $sensitive = false): bool {
			if ($key === 'bug_drop_token') {
				$this->assertSame('', $value);
				$this->assertTrue($sensitive);
			}
			return true;
		});
		$controller = new AdminController($this->createMock(IRequest::class), $config, $this->createMock(IURLGenerator::class));
		$controller->save(clearToken: true);
	}
}
