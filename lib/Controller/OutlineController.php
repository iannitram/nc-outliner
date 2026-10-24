<?php
declare(strict_types=1);

namespace OCA\Outliner\Controller;

use OCA\Outliner\AppInfo\Application;
use OCA\Outliner\Service\OutlineFiles;
use OCP\AppFramework\Controller;
use OCP\AppFramework\Http\Attribute\NoAdminRequired;
use OCP\AppFramework\Http\JSONResponse;
use OCP\IRequest;

class OutlineController extends Controller
{
    public function __construct(IRequest $request, private OutlineFiles $files)
    {
        parent::__construct(Application::APP_ID, $request);
    }

    private function respond(callable $action): JSONResponse
    {
        try {
            return new JSONResponse($action());
        } catch (\InvalidArgumentException $e) {
            return new JSONResponse(['error' => $e->getMessage()], 400);
        } catch (\OCP\Files\NotFoundException) {
            return new JSONResponse(['error' => 'Outline not found.'], 404);
        } catch (\OCP\Files\NotPermittedException) {
            return new JSONResponse(['error' => 'You do not have permission to access this outline.'], 403);
        } catch (\OCP\Files\AlreadyExistsException) {
            return new JSONResponse(['error' => 'An outline with that name already exists.'], 409);
        } catch (\OCP\Lock\LockedException) {
            return new JSONResponse(['error' => 'Outline is busy. Try again.'], 423);
        } catch (\RuntimeException $e) {
            $status = in_array($e->getCode(), [401, 409, 412], true) ? $e->getCode() : 500;
            return new JSONResponse(['error' => $status === 500 ? 'Unable to access outline.' : $e->getMessage()], $status);
        }
    }

    #[NoAdminRequired]
    public function index(): JSONResponse { return $this->respond(fn () => $this->files->listing()); }

    #[NoAdminRequired]
    public function create(string $name = ''): JSONResponse { return $this->respond(fn () => $this->files->create($name)); }

    #[NoAdminRequired]
    public function show(string $name): JSONResponse { return $this->respond(fn () => $this->files->open($name)); }

    #[NoAdminRequired]
    public function update(string $name, array $document = []): JSONResponse
    {
        // Only a strong, exact If-Match value can authorize replacing this file.
        $header = $this->request->getHeader('If-Match');
        $etag = '';
        if (strlen($header) >= 2 && $header[0] === '"' && str_ends_with($header, '"')) {
            $candidate = substr($header, 1, -1);
            if (!str_contains($candidate, '"') && !str_contains($candidate, "\r") && !str_contains($candidate, "\n")) {
                $etag = $candidate;
            }
        }
        return $this->respond(fn () => $this->files->save($name, $document, $etag));
    }

    #[NoAdminRequired]
    public function copy(string $name, array $document = []): JSONResponse
    {
        return $this->respond(fn () => $this->files->keepCopy($name, $document));
    }
    #[NoAdminRequired]
    public function export(string $name, array $document = []): JSONResponse { return $this->respond(fn () => $this->files->export($name, $document)); }
}
