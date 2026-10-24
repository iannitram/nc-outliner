<?php
declare(strict_types=1);

namespace OCA\Outliner\Controller;

use OCA\Outliner\AppInfo\Application;
use OCA\Outliner\Service\OutlineName;
use OCA\Outliner\Service\OutlineStorage;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\DataResponse;
use OCP\Files\GenericFileException;
use OCP\Files\NotFoundException;
use OCP\IRequest;
use OCP\IUserSession;

class OutlineController extends Controller
{
    public function __construct(IRequest $request, private OutlineStorage $storage, private IUserSession $session)
    {
        parent::__construct(Application::APP_ID, $request);
    }

    #[NoAdminRequired]
    public function index(): DataResponse
    {
        $uid = $this->uid();
        return $uid === null ? new DataResponse(['error' => 'unauthorized'], 401) : new DataResponse($this->storage->list($uid), 200);
    }

    #[NoAdminRequired]
    public function show(string $name): DataResponse
    {
        $normalized = OutlineName::normalize($name);
        if ($normalized === null) return new DataResponse(['error' => 'invalid name'], 400);
        $uid = $this->uid();
        if ($uid === null) return new DataResponse(['error' => 'unauthorized'], 401);
        try { return new DataResponse($this->storage->read($uid, $normalized), 200); }
        catch (NotFoundException) { return new DataResponse(['error' => 'not found'], 404); }
    }

    #[NoAdminRequired]
    public function create(?string $name = null, ?string $content = null): DataResponse
    {
        if ($name === null) return new DataResponse(['error' => 'invalid name'], 400);
        $normalized = OutlineName::normalize($name);
        if ($normalized === null) return new DataResponse(['error' => 'invalid name'], 400);
        if ($content === null) return new DataResponse(['error' => 'invalid content'], 400);
        $uid = $this->uid();
        if ($uid === null) return new DataResponse(['error' => 'unauthorized'], 401);
        try { return new DataResponse($this->storage->create($uid, $normalized, $content), 201); }
        catch (GenericFileException) { return new DataResponse(['error' => 'exists'], 409); }
    }

    private function uid(): ?string
    {
        return $this->session->getUser()?->getUID();
    }
}
