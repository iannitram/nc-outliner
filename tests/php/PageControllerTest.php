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
}
