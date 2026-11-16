<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests;

use OCA\NcOutliner\Controller\PageController;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IRequest;
use OCP\IAppConfig;
use OCP\App\IAppManager;
use OCP\AppFramework\Services\IInitialState;
use OCP\ServerVersion;
use PHPUnit\Framework\TestCase;

final class PageControllerTest extends TestCase {
	public function testIndexReturnsTheMainTemplate(): void {
		$controller = new PageController(
			$this->createMock(IRequest::class),
			$this->createMock(IInitialState::class),
			$this->createMock(IAppManager::class),
			$this->createMock(IAppConfig::class),
			$this->createMock(ServerVersion::class),
		);

		$response = $controller->index();

		$this->assertInstanceOf(TemplateResponse::class, $response);
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame('nc_outliner', $response->getApp());
	}

	// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	public function testIndexPassesTheCrashLogSwitchAndTheVersionsToThePage(): void {
		$appConfig = $this->createMock(IAppConfig::class);
		$appConfig->method('getValueString')->willReturnCallback(
			static fn (string $app, string $key, string $default = ''): string => $key === 'crash_log' ? '0' : '',
		);
		$appManager = $this->createMock(IAppManager::class);
		$appManager->method('getAppVersion')->willReturn('0.1.0');
		$serverVersion = $this->createMock(ServerVersion::class);
		$serverVersion->method('getVersionString')->willReturn('33.0.10.1');
		$controller = new PageController($this->createMock(IRequest::class), $this->createMock(IInitialState::class), $appManager, $appConfig, $serverVersion);

		$response = $controller->index();

		$this->assertSame(['crashLog' => '0', 'appVersion' => '0.1.0', 'ncVersion' => '33.0.10.1'], $response->getParams());
	}
}
