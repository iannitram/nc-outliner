<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\SettingsController;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;

final class SettingsControllerTest extends TestCase {
	private IConfig&MockObject $config;

	private function controller(): SettingsController {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createMock(IUserSession::class);
		$session->method('getUser')->willReturn($user);
		$this->config = $this->createMock(IConfig::class);
		return new SettingsController($this->createMock(IRequest::class), $this->config, $session);
	}

	public function testGetWithNothingStoredReturnsAuto(): void {
		$controller = $this->controller();
		$this->config->expects($this->once())
			->method('getUserValue')
			->with('alice', 'nc_outliner', 'theme', 'auto')
			->willReturn('auto');

		$response = $controller->get();

		$this->assertInstanceOf(JSONResponse::class, $response);
		$this->assertSame(Http::STATUS_OK, $response->getStatus());
		$this->assertSame(['theme' => 'auto'], $response->getData());
	}

	public function testSetDarkStoresItAndReturns200(): void {
		$controller = $this->controller();
		$this->config->expects($this->once())
			->method('setUserValue')
			->with('alice', 'nc_outliner', 'theme', 'dark');

		$response = $controller->set('dark');

		$this->assertSame(200, $response->getStatus());
		$this->assertSame(['theme' => 'dark'], $response->getData());
	}

	public function testSetBlueReturns400AndStoresNothing(): void {
		$controller = $this->controller();
		$this->config->expects($this->never())->method('setUserValue');

		$response = $controller->set('blue');

		$this->assertSame(400, $response->getStatus());
		$this->assertSame(['message' => 'theme must be auto, light or dark'], $response->getData());
	}
}
