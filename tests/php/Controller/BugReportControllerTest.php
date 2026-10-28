<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\BugReportController;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Http\Client\IClient;
use OCP\Http\Client\IClientService;
use OCP\Http\Client\IResponse;
use OCP\IAppConfig;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\Attributes\DataProvider;
use PHPUnit\Framework\TestCase;

final class BugReportControllerTest extends TestCase {
	private const BASE = 'https://drop.example.invalid';
	private const TOKEN = 'TEST-TOKEN-123';
	private const NAME = 'Outliner-web-20261028T120000Z-1234abcd.zip';
	private IRequest $request;
	private IClient $client;
	private IClientService $clients;
	private IAppConfig $appConfig;
	private IConfig $config;
	private IUserSession $session;
	private string $temp;
	private array $upload;
	private array $settings;
	private array $times = [];
	private BugReportController $controller;

	protected function setUp(): void {
		$this->temp = tempnam(sys_get_temp_dir(), 'report');
		file_put_contents($this->temp, "PK\x03\x04zip bytes\x00");
		$this->upload = ['name' => self::NAME, 'size' => filesize($this->temp), 'tmp_name' => $this->temp, 'error' => UPLOAD_ERR_OK];
		$this->settings = ['bug_drop_base' => self::BASE . '///', 'bug_drop_token' => self::TOKEN];
		$this->request = $this->createMock(IRequest::class);
		$this->client = $this->createMock(IClient::class);
		$this->clients = $this->createMock(IClientService::class);
		$this->clients->method('newClient')->willReturn($this->client);
		$this->appConfig = $this->createMock(IAppConfig::class);
		$this->appConfig->method('getValueString')->willReturnCallback(fn ($app, $key) => $this->settings[$key] ?? '');
		$this->config = $this->createMock(IConfig::class);
		$this->config->method('getUserValue')->willReturnCallback(fn () => json_encode($this->times));
		$this->config->method('setUserValue')->willReturnCallback(function ($uid, $app, $key, $value): void {
			$this->assertSame('report-user', $uid);
			$this->times = json_decode($value, true);
		});
		$this->session = $this->createMock(IUserSession::class);
		$this->controller = new BugReportController($this->request, $this->clients, $this->appConfig, $this->config, $this->session);
	}

	protected function tearDown(): void {
		unlink($this->temp);
	}

	private function signedIn(): void {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('report-user');
		$this->session->method('getUser')->willReturn($user);
	}

	private function upload(): void {
		$this->request->method('getUploadedFile')->with('report')->willReturnCallback(fn () => $this->upload);
	}

	private function check(JSONResponse $response, int $status, ?array $data = null): void {
		$this->assertSame($status, $response->getStatus());
		$json = json_encode($response->getData());
		$this->assertStringNotContainsString(self::TOKEN, $json);
		$this->assertStringNotContainsString(self::BASE, str_replace('\\/', '/', $json));
		if ($data !== null) {
			$this->assertSame($data, $response->getData());
		}
	}

	public function testSignedOutCannotForward(): void {
		$this->client->expects($this->never())->method('put');
		$this->request->expects($this->never())->method('getUploadedFile');
		$this->check($this->controller->relay(), 401);
	}

	public function testMissingFile(): void {
		$this->signedIn();
		$this->request->method('getUploadedFile')->willReturn(null);
		$this->client->expects($this->never())->method('put');
		$this->check($this->controller->relay(), 400);
	}

	public static function rejectedUploads(): array {
		return [
			'upload error' => ['error', UPLOAD_ERR_PARTIAL, 400],
			'oversize' => ['size', 10 * 1024 * 1024 + 1, 413],
			'path traversal' => ['name', '../' . self::NAME, 400],
			'wrong extension' => ['name', 'report.php', 400],
			'missing T' => ['name', 'Outliner-web-20261028120000Z-1234abcd.zip', 400],
			'short hex' => ['name', 'Outliner-web-20261028T120000Z-abcd.zip', 400],
			'uppercase hex' => ['name', 'Outliner-web-20261028T120000Z-1234ABCD.zip', 400],
			'app punctuation' => ['name', 'Out_liner-web-20261028T120000Z-1234abcd.zip', 400],
			'trailing newline' => ['name', self::NAME . "\n", 400],
		];
	}

	#[DataProvider('rejectedUploads')]
	public function testRejectedUpload(string $key, mixed $value, int $status): void {
		$this->signedIn();
		$this->upload[$key] = $value;
		$this->upload();
		$this->client->expects($this->never())->method('put');
		$this->check($this->controller->relay(), $status);
	}

	public function testSixthReportIsRejected(): void {
		$this->signedIn();
		$this->upload();
		$this->times = array_fill(0, 5, time() - 30);
		$this->client->expects($this->never())->method('put');
		$this->check($this->controller->relay(), 429);
	}

	public static function missingSettings(): array {
		return [['bug_drop_base'], ['bug_drop_token']];
	}

	#[DataProvider('missingSettings')]
	public function testNotConfigured(string $key): void {
		$this->signedIn();
		$this->upload();
		$this->settings[$key] = '';
		$this->client->expects($this->never())->method('put');
		$this->check($this->controller->relay(), 503, ['message' => 'Bug reports are not set up for this app.']);
	}

	public static function dropStatuses(): array {
		return [[201, 201], [204, 201], [403, 502], [500, 502], [302, 502]];
	}

	#[DataProvider('dropStatuses')]
	public function testForwardedBytesAndGenericResponse(int $dropStatus, int $status): void {
		$this->signedIn();
		$this->upload();
		$this->times = [time() - 3601];
		$drop = $this->createMock(IResponse::class);
		$drop->method('getStatusCode')->willReturn($dropStatus);
		$this->client->expects($this->once())->method('put')->with(
			self::BASE . '/public.php/dav/files/' . self::TOKEN . '/' . self::NAME,
			['body' => file_get_contents($this->temp), 'headers' => ['Content-Type' => 'application/zip'], 'allow_redirects' => false],
		)->willReturn($drop);
		$this->check($this->controller->relay(), $status, $status === 201 ? ['sent' => true] : ['message' => 'The bug drop refused the report.']);
		$this->assertCount(1, $this->times);
	}

	public function testClientExceptionDoesNotLeakSecrets(): void {
		$this->signedIn();
		$this->upload();
		$this->client->expects($this->once())->method('put')->willThrowException(new \RuntimeException(self::BASE . '/' . self::TOKEN));
		$this->check($this->controller->relay(), 502, ['message' => 'The bug drop refused the report.']);
	}

	public function testSixSequentialAttemptsOnlyForwardFiveReports(): void {
		$this->signedIn();
		$this->upload();
		$drop = $this->createMock(IResponse::class);
		$drop->method('getStatusCode')->willReturn(201);
		$this->client->expects($this->exactly(5))->method('put')->willReturn($drop);
		for ($i = 0; $i < 5; $i++) {
			$this->check($this->controller->relay(), 201, ['sent' => true]);
		}
		$this->check($this->controller->relay(), 429);
	}

	public function testTokenIsEncodedAsOnePathSegment(): void {
		$this->signedIn();
		$this->upload();
		$this->settings['bug_drop_token'] = self::TOKEN . '/+?';
		$drop = $this->createMock(IResponse::class);
		$drop->method('getStatusCode')->willReturn(201);
		$this->client->expects($this->once())->method('put')->with(
			self::BASE . '/public.php/dav/files/' . self::TOKEN . '%2F%2B%3F/' . self::NAME,
			$this->anything(),
		)->willReturn($drop);
		$this->check($this->controller->relay(), 201, ['sent' => true]);
	}

	public function testActualFileSizeIsCheckedEvenIfUploadSizeIsWrong(): void {
		$this->signedIn();
		$this->upload();
		file_put_contents($this->temp, str_repeat('x', 10 * 1024 * 1024 + 1));
		$this->client->expects($this->never())->method('put');
		$this->check($this->controller->relay(), 413);
	}

	public function testAuthenticationAndCsrfAttributes(): void {
		$method = new \ReflectionMethod(BugReportController::class, 'relay');
		$this->assertCount(1, $method->getAttributes(NoAdminRequired::class));
		$this->assertSame([], $method->getAttributes(PublicPage::class));
		$this->assertSame([], $method->getAttributes(NoCSRFRequired::class));
	}
}
