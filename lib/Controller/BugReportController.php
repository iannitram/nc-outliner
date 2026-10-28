<?php

declare(strict_types=1);

namespace OCA\NcOutliner\Controller;

use OCA\NcOutliner\AppInfo\Application;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\Http\Client\IClientService;
use OCP\IAppConfig;
use OCP\IConfig;
use OCP\IRequest;
use OCP\IUserSession;

final class BugReportController extends Controller {
	public function __construct(
		IRequest $request,
		private readonly IClientService $clientService,
		private readonly IAppConfig $appConfig,
		private readonly IConfig $config,
		private readonly IUserSession $userSession,
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
		if ($base === '' || $token === '') {
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
		$times[] = $now;
		$this->config->setUserValue($user->getUID(), Application::APP_ID, 'bug_report_times', json_encode($times));
		try {
			$response = $this->clientService->newClient()->put(
				rtrim($base, '/') . '/public.php/dav/files/' . rawurlencode($token) . '/' . $file['name'],
				['body' => $bytes, 'headers' => ['Content-Type' => 'application/zip'], 'allow_redirects' => false],
			);
			if (in_array($response->getStatusCode(), [201, 204], true)) {
				return new JSONResponse(['sent' => true], 201);
			}
		} catch (\Throwable) {
			// Client exceptions can include the private URL. Never expose or log them.
		}
		return new JSONResponse(['message' => 'The bug drop refused the report.'], 502);
	}
}
