<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Constants;
use OCP\Files\Folder;
use OCP\Http\Client\IClientService;
use OCP\IAppConfig;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUserSession;
use OCP\Share\Exceptions\ShareNotFound;
use OCP\Share\IManager as IShareManager;
use OCP\Share\IShare;
use Psr\Log\LoggerInterface;

final class BugReportController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IClientService $clientService,
		private readonly IAppConfig $appConfig,
		private readonly IConfig $config,
		private readonly IUserSession $userSession,
		private readonly IShareManager $shareManager,
		private readonly LoggerInterface $logger,
	) {
		parent::__construct(Application::APP_ID, $request);
	}

	#[NoAdminRequired]
	public function relay(): JSONResponse {
		$user = $this->userSession->getUser();
		if ($user === null) {
			return new JSONResponse(['message' => 'Sign in to send a report.'], 401);
		}
		$file = $this->request->getUploadedFile('report');
		if (!is_array($file) || ($file['error'] ?? UPLOAD_ERR_NO_FILE) !== UPLOAD_ERR_OK) {
			return new JSONResponse(['message' => 'A report file is required.'], 400);
		}
		if (($file['size'] ?? 0) > 10 * 1024 * 1024) {
			return new JSONResponse(['message' => 'The report is too large.'], 413);
		}
		// Exact shape emitted by craft-bugreport-web's core/filename.js.
		if (!preg_match('/\A[A-Za-z0-9]+-web-\d{8}T\d{6}Z-[0-9a-f]{8}\.zip\z/', $file['name'] ?? '')) {
			return new JSONResponse(['message' => 'Invalid report file name.'], 400);
		}
		$now = time();
		$stored = json_decode($this->config->getUserValue($user->getUID(), Application::APP_ID, 'bug_report_times', '[]'), true);
		$times = array_values(array_filter(is_array($stored) ? $stored : [], static fn ($stamp): bool => is_int($stamp) && $stamp > $now - 3600));
		if (count($times) >= 5) {
			return new JSONResponse(['message' => 'Too many reports. Try again later.'], 429);
		}
		$base = $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_base');
		$token = $this->appConfig->getValueString(Application::APP_ID, 'bug_drop_token');
		if ($token === '') {
			return new JSONResponse(['message' => 'Bug reports are not set up for this app.'], 503);
		}
		if (empty($file['tmp_name']) || !is_string($file['tmp_name'])) {
			return new JSONResponse(['message' => 'Could not read the report.'], 400);
		}
		$bytes = @file_get_contents($file['tmp_name'], false, null, 0, 10 * 1024 * 1024 + 1);
		if ($bytes === false) {
			return new JSONResponse(['message' => 'Could not read the report.'], 400);
		}
		if (strlen($bytes) > 10 * 1024 * 1024) {
			return new JSONResponse(['message' => 'The report is too large.'], 413);
		}
		// The drop is normally a File Drop share on this same Nextcloud: write the zip into it
		// directly, so nothing goes over the network (owner, 2026-10-28). Only a token that is not
		// a share here falls back to the drop's public WebDAV URL.
		try {
			$share = $this->shareManager->getShareByToken($token);
		} catch (ShareNotFound) {
			$share = null;
		} catch (\Throwable $e) {
			$this->logger->error('Bug report relay: could not look up the drop share: ' . get_class($e), ['app' => Application::APP_ID]);
			return new JSONResponse(['message' => 'The bug drop refused the report.'], 502);
		}
		if ($share !== null) {
			// Core's getShareByToken() drops expired shares but never checks a share's password (the
			// public-share auth layer does that), so every condition is checked here. A refusal never
			// falls back to HTTP: that would hand the same share to the public endpoint.
			$refusal = $this->localDropRefusal($share);
			if ($refusal !== null) {
				$this->logger->error('Bug report relay: ' . $refusal, ['app' => Application::APP_ID]);
				return new JSONResponse(['message' => 'The bug drop refused the report.'], 502);
			}
			try {
				/** @var Folder $folder */
				$folder = $share->getNode();
				$folder->newFile($file['name'], $bytes);
			} catch (\Throwable $e) {
				$this->logger->error('Bug report relay: could not write the report into the drop share: ' . get_class($e), ['app' => Application::APP_ID]);
				return new JSONResponse(['message' => 'The bug drop refused the report.'], 502);
			}
			$this->countAttempt($user->getUID(), $times, $now);
			return new JSONResponse(['sent' => true], 201);
		}
		if ($base === '') {
			$this->logger->error('Bug report relay: the drop token is not a share here and no drop base URL is set', ['app' => Application::APP_ID]);
			return new JSONResponse(['message' => 'Bug reports are not set up for this app.'], 503);
		}
		try {
			$response = $this->clientService->newClient()->put(
				rtrim($base, '/') . '/public.php/dav/files/' . rawurlencode($token) . '/' . $file['name'],
				['body' => $bytes, 'headers' => ['Content-Type' => 'application/zip'], 'allow_redirects' => false],
			);
			if (in_array($response->getStatusCode(), [201, 204], true)) {
				$this->countAttempt($user->getUID(), $times, $now);
				return new JSONResponse(['sent' => true], 201);
			}
			$this->logger->error('Bug report relay: the drop answered HTTP ' . $response->getStatusCode(), ['app' => Application::APP_ID]);
		} catch (\Throwable $e) {
			// Client exceptions can include the private URL: log the class only, never the message.
			$this->logger->error('Bug report relay: the HTTP upload to the drop failed: ' . get_class($e), ['app' => Application::APP_ID]);
		}
		return new JSONResponse(['message' => 'The bug drop refused the report.'], 502);
	}

	/**
	 * Why a share may not take a local write, or null when it may. Only an open link or email
	 * folder share qualifies: no password, not expired, a folder node, create permission.
	 */
	private function localDropRefusal(IShare $share): ?string {
		if (!in_array($share->getShareType(), [IShare::TYPE_LINK, IShare::TYPE_EMAIL], true)) {
			return 'the drop token is not a link or email share';
		}
		if ((string)$share->getPassword() !== '') {
			return 'the drop share is password protected';
		}
		$expires = $share->getExpirationDate();
		if ($expires !== null && $expires <= new \DateTime()) {
			return 'the drop share has expired';
		}
		if (($share->getPermissions() & Constants::PERMISSION_CREATE) === 0) {
			return 'the drop share does not allow creating files';
		}
		try {
			if (!$share->getNode() instanceof Folder) {
				return 'the drop share is not a folder';
			}
		} catch (\Throwable $e) {
			return 'the drop share folder could not be opened: ' . get_class($e);
		}
		return null;
	}

	/**
	 * Record one sending attempt for the hourly rate limit.
	 *
	 * @param list<int> $times the user's attempts within the last hour
	 */
	private function countAttempt(string $uid, array $times, int $now): void {
		$times[] = $now;
		$this->config->setUserValue($uid, Application::APP_ID, 'bug_report_times', json_encode($times));
	}
}
