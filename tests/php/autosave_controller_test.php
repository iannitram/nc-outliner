<?php
declare(strict_types=1);
namespace OCP { interface IRequest { public function getHeader(string $name): string; } }
namespace OCP\AppFramework {
    class Controller {
        public function __construct(string $appId, protected \OCP\IRequest $request) {}
    }
}
namespace OCP\AppFramework\Http {
    class JSONResponse { public function __construct(public mixed $data, public int $status = 200) {} }
}
namespace OCA\Outliner\AppInfo { class Application { public const APP_ID = 'outliner'; } }
namespace {
require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/OutlineFiles.php';
require __DIR__ . '/../../lib/Controller/OutlineController.php';
$storage = new class extends \OCA\Outliner\Service\OutlineFiles {
    public array $received = [];
    public function __construct() {}
    public function save(string $name, array $document, string $etag): array {
        $this->received = [$name, $document, $etag];
        if ($etag === '') throw new \RuntimeException('Conflict', 412);
        return ['name' => $name, 'etag' => 'next'];
    }
    public function keepCopy(string $name, array $document): array {
        return ['name' => 'copy.opml', 'etag' => 'copy-etag', 'document' => $document];
    }
};
$request = new class implements \OCP\IRequest {
    public string $header = '';
    public function getHeader(string $name): string {
        if ($name !== 'If-Match') throw new \LogicException('Unexpected header');
        return $this->header;
    }
};
$controller = new \OCA\Outliner\Controller\OutlineController($request, $storage);
check('strong If-Match is passed to guarded storage save', function () use ($controller, $request, $storage): void {
    $request->header = '"v1"';
    same(200, $controller->update('Plan.opml', ['title' => 'Plan', 'rows' => []])->status);
    same('v1', $storage->received[2]);
});
check('missing, weak, wildcard and multiple etags cannot authorize overwrite', function () use ($controller, $request): void {
    foreach (['', '*', 'W/"v1"', '"v1", "v2"', "\"bad\rvalue\""] as $header) {
        $request->header = $header;
        same(412, $controller->update('Plan.opml', ['title' => 'Plan', 'rows' => []])->status);
    }
});
check('keep-copy endpoint returns a new document without calling overwrite', function () use ($controller): void {
    $document = ['title' => 'Local', 'rows' => []];
    $response = $controller->copy('Plan.opml', $document);
    same(200, $response->status);
    same('copy.opml', $response->data['name']);
    same($document, $response->data['document']);
});
}
