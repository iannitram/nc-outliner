<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests;

use OCA\NcOutliner\Controller\PageController;
use OCP\App\IAppManager;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\IAppConfig;
use OCP\IConfig;
use OCP\IRequest;
use PHPUnit\Framework\TestCase;

final class PageControllerTest extends TestCase {
	public function testIndexReturnsTheMainTemplate(): void {
		$controller = new PageController(
			$this->createMock(IRequest::class),
			$this->createMock(IAppConfig::class),
			$this->createMock(IAppManager::class),
			$this->createMock(IConfig::class),
		);

		$response = $controller->index();

		$this->assertInstanceOf(TemplateResponse::class, $response);
		$this->assertSame('main', $response->getTemplateName());
		$this->assertSame('nc_outliner', $response->getApp());
	}

	// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)
	public function testIndexPassesTheCrashLogSwitchAndTheVersionsToThePage(): void {
		$appConfig = $this->createMock(IAppConfig::class);
		$appConfig->expects($this->once())->method('getValueString')->with('nc_outliner', 'crash_log', '1')->willReturn('0');
		$appManager = $this->createMock(IAppManager::class);
		$appManager->method('getAppVersion')->willReturn('0.1.0');
		$config = $this->createMock(IConfig::class);
		$config->method('getSystemValueString')->with('version', '')->willReturn('33.0.10.1');
		$controller = new PageController($this->createMock(IRequest::class), $appConfig, $appManager, $config);

		$response = $controller->index();

		$this->assertSame(['crashLog' => '0', 'appVersion' => '0.1.0', 'ncVersion' => '33.0.10.1'], $response->getParams());
	}
}
