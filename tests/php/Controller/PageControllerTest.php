<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\PageController;
use OCP\App\IAppManager;
use OCP\AppFramework\Services\IInitialState;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\ServerVersion;
use PHPUnit\Framework\TestCase;

final class PageControllerTest extends TestCase {
	public function testInitialStateContainsMetadataAndReadinessOnly(): void {
		$state = $this->createMock(IInitialState::class);
		$apps = $this->createMock(IAppManager::class);
		$apps->method('getAppVersion')->with('nc_outliner')->willReturn('0.1.0');
		$config = $this->createMock(IAppConfig::class);
		$config->method('getValueString')->willReturnCallback(fn ($app, $key) => $key === 'bug_drop_base' ? 'https://drop.example.invalid' : 'TEST-TOKEN-123');
		$version = $this->createMock(ServerVersion::class);
		$version->method('getVersionString')->willReturn('33.0.10');
		$state->expects($this->once())->method('provideInitialState')->with('bugReport', $this->callback(function ($data): bool {
			$this->assertSame(['version', 'commit', 'ncVersion', 'configured'], array_keys($data));
			$this->assertSame('0.1.0', $data['version']);
			$this->assertSame('33.0.10', $data['ncVersion']);
			$this->assertTrue($data['configured']);
			$this->assertStringNotContainsString('TEST-TOKEN-123', json_encode($data));
			$this->assertStringNotContainsString('https://drop.example.invalid', str_replace('\\/', '/', json_encode($data)));
			return true;
		}));
		(new PageController($this->createMock(IRequest::class), $state, $apps, $config, $version))->index();
	}
}
