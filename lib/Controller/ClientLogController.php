<?php
// TEMPORARY: remove after the crash-rate review (owner, 2026-10-28)

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IAppConfig;
use OCP\IRequest;
use OCP\IUserSession;
use Psr\Log\LoggerInterface;

/**
 * TEMPORARY: remove after the crash-rate review (owner, 2026-10-28). Browser crash events (issue #177)
 * arrive at POST /api/clientlog and go to Nextcloud's log, one line each, behind app config crash_log
 * ('0' turns it off). The sanitizers here also apply to exceptions the other controllers let escape.
 * Nothing but the sanitized fields is logged, and the request body is never logged.
 */
final class ClientLogController extends Controller {
	private const LEVELS = ['error', 'warning'];
	private const KINDS = ['error', 'rejection', 'vue', 'save'];
	private const MAX_EVENTS = 20;
	private const MAX_INPUT = 8192;
	private const MAX_MESSAGE = 500;
	private const MAX_STACK = 2048;
	private const MAX_VIEW = 100;
	private const MAX_USER_AGENT = 200;
	// Same rule as the browser: a path with an extension; a path whose name has spaces; any token with a
	// path separator; a bare file name with an extension.
	private const FILE_LIKE = '~\S*[\\\/]\S*\.[A-Za-z0-9]{1,6}(?![A-Za-z0-9])|\S*[\\\/]\S*(?:\s+[^\s\\\/]+){0,3}?\s+[^\s\\\/]+\.[A-Za-z0-9]{1,6}(?![A-Za-z0-9])|\S*[\\\/]\S*|[^\s,;:()<>\[\]{}]*\.[A-Za-z0-9]{1,6}(?![A-Za-z0-9])~';

	public function __construct(
		IRequest $request,
		private readonly IAppConfig $appConfig,
		private readonly IUserSession $userSession,
		private readonly LoggerInterface $logger,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	/** Signed-in users only: no #[PublicPage], so the framework already refuses anonymous requests. */
	#[NoAdminRequired]
	public function receive(): JSONResponse {
		if ($this->userSession->getUser() === null) {
			return new JSONResponse([], Http::STATUS_UNAUTHORIZED);
		}
		if ($this->appConfig->getValueString(Application::APP_ID, 'crash_log', '1') === '0') {
			return new JSONResponse([], Http::STATUS_FORBIDDEN);
		}
		$events = $this->request->getParam('events');
		if (!is_array($events)) {
			return new JSONResponse(['message' => 'events must be a list'], Http::STATUS_BAD_REQUEST);
		}

		$logged = 0;
		foreach (array_slice(array_values($events), 0, self::MAX_EVENTS) as $event) {
			$described = self::describeEvent($event);
			if ($described === null) {
				continue;
			}
			if ($described['level'] === 'error') {
				$this->logger->error($described['line'], ['app' => Application::APP_ID]);
			} else {
				$this->logger->warning($described['line'], ['app' => Application::APP_ID]);
			}
			$logged++;
		}
		return new JSONResponse(['logged' => $logged]);
	}

	/**
	 * Logs an exception that escaped a controller action, at error level with the app tag. Never throws,
	 * so the caller can rethrow the original exception and keep its response. Logs nothing when crash_log
	 * is '0'; $appConfig is for tests, the controllers leave it out and the server's config is read.
	 */
	public static function reportServerException(LoggerInterface $logger, string $where, \Throwable $e, ?IAppConfig $appConfig = null): void {
		try {
			$appConfig ??= \OCP\Server::get(IAppConfig::class);
			if ($appConfig->getValueString(Application::APP_ID, 'crash_log', '1') === '0') {
				return;
			}
		} catch (\Throwable) {
			// The switch cannot be read (no server, as in unit tests): log, as the default is on.
		}
		try {
			$logger->error(sprintf(
				'server exception in %s: %s: %s at %s:%d',
				$where,
				$e::class,
				self::sanitizeText($e->getMessage()),
				basename($e->getFile()),
				$e->getLine(),
			), ['app' => Application::APP_ID]);
		} catch (\Throwable) {
			// A logging failure must not replace the original exception.
		}
	}

	/**
	 * Control characters become spaces, quoted text (straight or typographic) becomes "…", an unpaired quote
	 * cuts the rest, full URLs become "<url>", query strings and fragments go, file names and paths become
	 * "<file>" (not for a user agent); at most 500 bytes. Text that is not valid UTF-8 is dropped whole.
	 */
	public static function sanitizeText(string $text, bool $keepPaths = false): string {
		// Control characters and line separators become spaces, so one event is one log line.
		$text = preg_replace('/[\p{Cc}\p{Zl}\p{Zp}]/u', ' ', mb_strcut($text, 0, self::MAX_INPUT, 'UTF-8')) ?? '';
		$text = preg_replace('/\'[^\']*\'|"[^"]*"|`[^`]*`|“[^”]*”|‘[^’]*’|«[^»]*»/u', '…', $text) ?? '';
		if (preg_match('/[\'"`“”‘’«»]/u', $text, $quote, PREG_OFFSET_CAPTURE) === 1) {
			$text = substr($text, 0, $quote[0][1]) . '…';
		}
		$text = preg_replace('~[a-z][a-z0-9+.\-]*://\S*~i', '<url>', $text) ?? '';
		$text = preg_replace('~[?#]\S*~', '', $text) ?? '';
		if (!$keepPaths) {
			$text = preg_replace(self::FILE_LIKE, '<file>', $text) ?? '';
		}
		return mb_strcut($text, 0, self::MAX_MESSAGE, 'UTF-8');
	}

	/** One "at file:line:col" per frame; only the app's own scripts keep their file name; at most 2 KB. */
	public static function sanitizeStack(string $stack): string {
		$frames = [];
		foreach (preg_split('/\R/', mb_strcut($stack, 0, self::MAX_INPUT, 'UTF-8')) ?: [] as $line) {
			if (preg_match('/([^\s()@]+):(\d+):(\d+)\)?\s*$/', $line, $location) !== 1 || preg_match('/^\s*at\s|@/', $line) !== 1) {
				continue;
			}
			$frames[] = 'at ' . self::frameFile($location[1]) . ':' . $location[2] . ':' . $location[3];
		}
		return mb_strcut(implode("\n", $frames), 0, self::MAX_STACK, 'UTF-8');
	}

	/** Ids become ":id"; only plain route words are kept in a hash path or pathname. */
	public static function sanitizeView(string $view): string {
		$hashed = str_starts_with($view, '#');
		$path = explode('?', $hashed ? substr($view, 1) : $view)[0];
		$parts = array_map(static function (string $part): string {
			if ($part === '' || $part === ':id') {
				return $part;
			}
			if (ctype_digit($part)) {
				return ':id';
			}
			return preg_match('/^[a-z_-]{1,20}$/D', $part) === 1 ? $part : '…';
		}, explode('/', $path));
		return mb_strcut(($hashed ? '#' : '') . implode('/', $parts), 0, self::MAX_VIEW, 'UTF-8');
	}

	/** @return array{level: string, line: string}|null the log level and line, or null for an event to skip */
	private static function describeEvent(mixed $event): ?array {
		if (!is_array($event)) {
			return null;
		}
		$level = $event['level'] ?? null;
		$kind = $event['kind'] ?? null;
		if (!is_string($level) || !in_array($level, self::LEVELS, true)
			|| !is_string($kind) || !in_array($kind, self::KINDS, true)) {
			return null;
		}

		$line = sprintf(
			'client %s (%s): %s | view=%s | page=%s | app=%s | nc=%s | ua=%s | time=%s | stack=%s',
			$kind,
			$level,
			self::sanitizeText(self::field($event['message'] ?? '')),
			self::sanitizeView(self::field($event['view'] ?? '')),
			self::token($event['pageId'] ?? null, '/^[A-Za-z0-9]{0,64}$/D'),
			self::token($event['appVersion'] ?? null, '/^[\w.\-]{0,32}$/D'),
			self::token($event['ncVersion'] ?? null, '/^[\w.\-]{0,32}$/D'),
			mb_strcut(self::sanitizeText(self::field($event['userAgent'] ?? ''), true), 0, self::MAX_USER_AGENT, 'UTF-8'),
			self::token($event['time'] ?? null, '/^[0-9TZ:.\-]{0,30}$/D'),
			mb_strcut(str_replace("\n", ' / ', self::sanitizeStack(self::field($event['stack'] ?? ''))), 0, self::MAX_STACK, 'UTF-8'),
		);
		return ['level' => $level, 'line' => $line];
	}

	private static function frameFile(string $url): string {
		$path = str_replace('\\', '/', preg_split('/[?#]/', $url)[0] ?? '');
		$leaf = basename($path);
		return preg_match('/^nc_outliner[\w.\-]*\.m?js$/D', $leaf) === 1 ? $leaf : '<other>';
	}

	private static function field(mixed $value): string {
		return is_string($value) ? mb_strcut($value, 0, self::MAX_INPUT, 'UTF-8') : '';
	}

	private static function token(mixed $value, string $pattern): string {
		$text = is_string($value) ? $value : '';
		return preg_match($pattern, $text) === 1 ? $text : '';
	}
}
