<?php
declare(strict_types=1);

namespace OCA\Outliner\Controller;

use OCA\Outliner\AppInfo\Application;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\Attribute\NoCSRFRequired;
use OCP\AppFramework\Http\TemplateResponse;
use OCP\AppFramework\Controller;
use OCP\IRequest;
use OCP\IURLGenerator;
use OCP\IUserSession;

class PageController extends Controller
{
    public function __construct(
        IRequest $request,
        private IURLGenerator $urlGenerator,
        private IUserSession $session,
    ) {
        parent::__construct(Application::APP_ID, $request);
    }

    #[NoAdminRequired]
    #[NoCSRFRequired]
    public function index(): TemplateResponse
    {
        return new TemplateResponse(Application::APP_ID, 'main', [
            'uid' => $this->session->getUser()?->getUID() ?? '',
            'apiBase' => rtrim($this->urlGenerator->linkToRoute('outliner.page.index'), '/') . '/api',
            'webroot' => $this->urlGenerator->getWebroot(),
            'appJs' => $this->urlGenerator->linkTo('outliner', 'js/app.js'),
        ]);
    }
}
