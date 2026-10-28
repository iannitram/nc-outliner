<?php
// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

declare(strict_types=1);

namespace OCA\NcOutliner\Tests\Controller;

use OCA\NcOutliner\Controller\ClientLogController;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\PublicPage;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUser;
use OCP\IUserSession;
use PHPUnit\Framework\MockObject\MockObject;
use PHPUnit\Framework\TestCase;
use Psr\Log\LoggerInterface;

final class ClientLogControllerTest extends TestCase {
	private const CANARIES = [
		'CANARY_TEXT_7f3a',
		'CANARY_TITLE_7f3a',
		'CANARY_NOTE_7f3a',
		'CANARY_FILE_7f3a.opml',
		'CANARY_USER_7f3a',
	];

	private IRequest&MockObject $request;
	private LoggerInterface&MockObject $logger;

	private function controller(bool $signedIn = true, string $crashLog = '1'): ClientLogController {
		$user = $this->createMock(IUser::class);
		$user->method('getUID')->willReturn('alice');
		$session = $this->createMock(IUserSession::class);
		$session->method('getUser')->willReturn($signedIn ? $user : null);
		$appConfig = $this->createMock(IAppConfig::class);
		$appConfig->method('getValueString')->with('nc_outliner', 'crash_log', '1')->willReturn($crashLog);
		$this->request = $this->createMock(IRequest::class);
		$this->logger = $this->createMock(LoggerInterface::class);
		return new ClientLogController($this->request, $appConfig, $session, $this->logger);
	}

	/** @param array<string, mixed> $fields @return array<string, mixed> one event, as the browser sends it */
	private function event(array $fields): array {
		return $fields + [
			'level' => 'error',
			'kind' => 'error',
			'message' => 'TypeError: boom',
			'stack' => '',
			'appVersion' => '0.1.0',
			'ncVersion' => '33.0.10',
			'view' => '#/outline/:id',
			'userAgent' => 'Mozilla/5.0',
			'pageId' => 'abc123',
			'time' => '2026-10-28T10:00:00.000Z',
		];
	}

	public function testValidEventsAreLoggedOnceEachAtTheirLevel(): void {
		$controller = $this->controller();
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event(['level' => 'error', 'kind' => 'error', 'message' => 'TypeError: boom', 'stack' => '    at f (https://nc.example/apps/nc_outliner/js/nc_outliner-main.mjs:1:2)']),
			$this->event(['level' => 'warning', 'kind' => 'save', 'message' => 'save failed']),
		]);
		$this->logger->expects($this->once())->method('error')
			->with($this->stringContains('client error (error): TypeError: boom'), ['app' => 'nc_outliner']);
		$this->logger->expects($this->once())->method('warning')
			->with($this->stringContains('client save (warning): save failed'), ['app' => 'nc_outliner']);

		$response = $controller->receive();

		$this->assertSame(200, $response->getStatus());
		$this->assertSame(['logged' => 2], $response->getData());
	}

	public function testAnonymousRequestIsRejectedAndNothingIsLogged(): void {
		$controller = $this->controller(false);
		$this->logger->expects($this->never())->method('error');
		$this->logger->expects($this->never())->method('warning');

		$response = $controller->receive();

		$this->assertSame(401, $response->getStatus());
	}

	public function testReceiveIsNotPublicOnTheClassOrTheMethod(): void {
		$class = new \ReflectionClass(ClientLogController::class);
		$method = $class->getMethod('receive');

		$this->assertSame([], $class->getAttributes(PublicPage::class));
		$this->assertSame([], $method->getAttributes(PublicPage::class));
		$this->assertNotSame([], $method->getAttributes(NoAdminRequired::class));
	}

	public function testCrashLogOffReturns403AndLogsNothing(): void {
		$controller = $this->controller(true, '0');
		$this->logger->expects($this->never())->method('error');
		$this->logger->expects($this->never())->method('warning');

		$response = $controller->receive();

		$this->assertSame(403, $response->getStatus());
	}

	public function testCanaryStringsNeverReachTheLogger(): void {
		$controller = $this->controller();
		$lines = [];
		$record = static function (string $line) use (&$lines): void {
			$lines[] = $line;
		};
		$this->logger->method('error')->willReturnCallback($record);
		$this->logger->method('warning')->willReturnCallback($record);
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event([
				'message' => 'failed on "CANARY_TEXT_7f3a"',
				'stack' => "    at f (https://nc.example/CANARY_FILE_7f3a.opml?x=1:3:4)\n"
					. '    at g (https://nc.example/apps/nc_outliner/js/nc_outliner-main.mjs?v=CANARY_USER_7f3a:5:6)',
				'view' => '#/CANARY_TITLE_7f3a',
				'userAgent' => 'Mozilla "CANARY_USER_7f3a"',
				'note' => 'CANARY_NOTE_7f3a',
				'title' => 'CANARY_TITLE_7f3a',
				'user' => 'CANARY_USER_7f3a',
			]),
		]);

		$response = $controller->receive();

		$this->assertSame(['logged' => 1], $response->getData());
		$this->assertCount(1, $lines);
		$this->assertStringContainsString('failed on …', $lines[0]);
		$this->assertStringContainsString('at nc_outliner-main.mjs:5:6', $lines[0]);
		foreach (self::CANARIES as $canary) {
			$this->assertStringNotContainsString($canary, $lines[0]);
		}
	}

	public function testLiveCanaryCaseNeverReachesTheLogger(): void {
		$controller = $this->controller();
		$lines = [];
		$this->logger->method('error')->willReturnCallback(static function (string $line) use (&$lines): void {
			$lines[] = $line;
		});
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event(['message' => 'Error: CRASHTEST_A uncaught on "CANARY_ROW_9z" in CANARY_FILE_9z.opml?x=1']),
		]);

		$controller->receive();

		$this->assertCount(1, $lines);
		$this->assertStringContainsString('Error: CRASHTEST_A uncaught on … in <file> |', $lines[0]);
		foreach (['CANARY_ROW_9z', 'CANARY_FILE_9z', 'x=1'] as $leaked) {
			$this->assertStringNotContainsString($leaked, $lines[0]);
		}
	}

	/** @return array<string, array{string, string, list<string>}> */
	public static function unquotedProvider(): array {
		return [
			'bare file' => ['failed to open Plan.opml', 'failed to open <file>', ['Plan']],
			'path with spaces' => ['save failed for /Outlines/Secret Plan.opml', 'save failed for <file>', ['Outlines', 'Secret', 'Plan']],
			'windows path' => ['C:\Users\x\file.txt', '<file>', ['Users', 'file.txt']],
			'url' => ['GET https://host/apps/x?token=abc#frag', 'GET <url>', ['host', 'token', 'abc', 'frag']],
			'query on an id' => ['item 42?draft=1', 'item 42', ['draft']],
			'several extensions' => ['wrote my-notes.odt and a.b.c.txt', 'wrote <file> and <file>', ['notes', 'a.b']],
			'plain message' => ['TypeError: Cannot read properties of undefined', 'TypeError: Cannot read properties of undefined', []],
		];
	}

	/** @param list<string> $absent */
	#[\PHPUnit\Framework\Attributes\DataProvider('unquotedProvider')]
	public function testUnquotedNamesPathsUrlsAndQueriesAreRedacted(string $input, string $expected, array $absent): void {
		$out = ClientLogController::sanitizeText($input);
		$this->assertSame($expected, $out);
		foreach ($absent as $word) {
			$this->assertStringNotContainsString($word, $out);
		}
	}

	public function testStackIsTrimmedTo2KiB(): void {
		$controller = $this->controller();
		$lines = [];
		$this->logger->method('error')->willReturnCallback(static function (string $line) use (&$lines): void {
			$lines[] = $line;
		});
		$stack = str_repeat("    at fn (https://nc.example/apps/nc_outliner/js/nc_outliner-main.mjs:1:2)\n", 500);
		$this->request->method('getParam')->with('events')->willReturn([
			$this->event(['stack' => $stack]),
		]);

		$controller->receive();

		$this->assertCount(1, $lines);
		$logged = substr($lines[0], strpos($lines[0], 'stack=') + strlen('stack='));
		$this->assertGreaterThan(0, strlen($logged));
		$this->assertLessThanOrEqual(2048, strlen($logged));
	}

	public function testMoreThan20EventsInOneRequestAreCutTo20(): void {
		$controller = $this->controller();
		$events = [];
		for ($i = 0; $i < 25; $i++) {
			$events[] = $this->event(['message' => "error $i"]);
		}
		$this->request->method('getParam')->with('events')->willReturn($events);
		$this->logger->expects($this->exactly(20))->method('error');

		$response = $controller->receive();

		$this->assertSame(['logged' => 20], $response->getData());
	}

	public function testSanitizersStripQuotesQueriesAndAllButAppFrames(): void {
		$this->assertSame('a … … … e', ClientLogController::sanitizeText('a \'b\' "c" `d` e'));
		$this->assertSame('cannot read …', ClientLogController::sanitizeText('cannot read "x of row'));
		$this->assertSame('Failed: <url>', ClientLogController::sanitizeText('Failed: https://nc.example/a.opml?f=1#x'));
		$this->assertSame(
			"at nc_outliner-main.mjs:1:2\nat <other>:3:4",
			ClientLogController::sanitizeStack("Error: x\n    at f (https://h/apps/nc_outliner/js/nc_outliner-main.mjs?v=1:1:2)\n    at g (https://h/other.js:3:4)\n    at <anonymous>"),
		);
		$this->assertSame('#/outline/:id', ClientLogController::sanitizeView('#/outline/7'));
	}

	public function testServerExceptionIsLoggedAtErrorLevelWithTheAppTag(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->once())->method('error')
			->with($this->stringContains('server exception in Foo::bar: RuntimeException: row … missing at ClientLogControllerTest.php:'), ['app' => 'nc_outliner']);

		ClientLogController::reportServerException($logger, 'Foo::bar', new \RuntimeException('row "CANARY_TEXT_7f3a" missing'));
	}

	public function testServerExceptionIsNotLoggedWhenTheSwitchIsOff(): void {
		$logger = $this->createMock(LoggerInterface::class);
		$logger->expects($this->never())->method($this->anything());
		$appConfig = $this->createMock(IAppConfig::class);
		$appConfig->method('getValueString')->with('nc_outliner', 'crash_log', '1')->willReturn('0');

		ClientLogController::reportServerException($logger, 'Foo::bar', new \RuntimeException('boom'), $appConfig);
	}

	public function testLogInjectionIsPrevented(): void {
		$this->assertSame('Error: a  FAKE b c d', ClientLogController::sanitizeText("Error: a\r\nFAKE\tb\u{2028}c\x1bd"));
		$this->assertSame('Error: … and …', ClientLogController::sanitizeText('Error: “CANARY_TEXT_7f3a” and «CANARY_NOTE_7f3a»'));
		$this->assertSame('Error: can…', ClientLogController::sanitizeText('Error: can’t find CANARY_TITLE_7f3a'));

		$controller = $this->controller();
		$this->request->method('getParam')->with('events')->willReturn([$this->event([
			'message' => "TypeError: boom\nFAKE LINE",
			'userAgent' => "Mozilla/5.0\r\nFAKE UA",
			'appVersion' => "0.1.0\n",
			'ncVersion' => "33\nFAKE",
			'pageId' => "abc\n",
			'time' => "2026-10-28T10:00:00.000Z\n",
			'view' => "#/outline\n/7",
		])]);
		$this->logger->expects($this->once())->method('error')->with($this->callback(
			static fn (string $line): bool => preg_match('/[\x00-\x1F\x7F]/', $line) !== 1 && !str_contains($line, '0.1.0'),
		), ['app' => 'nc_outliner']);

		$controller->receive();
	}
}
