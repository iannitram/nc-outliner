<?php
declare(strict_types=1);

namespace OCA\Outliner\Controller;

use OCA\Outliner\AppInfo\Application;
use OCA\Outliner\Service\ThemePreferences;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

class ThemeController extends Controller
{
    public function __construct(IRequest $request, private ThemePreferences $preferences)
    {
        parent::__construct(Application::APP_ID, $request);
    }

    private function respond(callable $action): JSONResponse
    {
        try {
            return new JSONResponse(['theme' => $action()]);
        } catch (\InvalidArgumentException $e) {
            return new JSONResponse(['error' => $e->getMessage()], 400);
        } catch (\RuntimeException $e) {
            $status = $e->getCode() === 401 ? 401 : 500;
            return new JSONResponse(['error' => $status === 401 ? $e->getMessage() : 'Unable to save appearance.'], $status);
        }
    }

    #[NoAdminRequired]
    public function show(): JSONResponse { return $this->respond(fn () => $this->preferences->get()); }

    #[NoAdminRequired]
    public function update(string $theme = ''): JSONResponse { return $this->respond(fn () => $this->preferences->set($theme)); }
}
