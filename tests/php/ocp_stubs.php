<?php
declare(strict_types=1);

namespace OCP\Files {
    class NotFoundException extends \Exception {}
    class GenericFileException extends \Exception {}
    interface Node { public function getName(): string; public function getMTime(): int; public function getSize(): int|float; public function getEtag(): string; }
    interface File extends Node { public function getContent(): string; }
    interface Folder extends Node { public function getDirectoryListing(): array; public function get(string $path): Node; public function nodeExists(string $path): bool; public function newFile(string $path, ?string $content = null): File; public function newFolder(string $path): Folder; }
    interface IRootFolder { public function getUserFolder(string $userId): Folder; }
}
namespace OCP { interface IRequest {} interface IUser { public function getUID(): string; } interface IUserSession { public function getUser(): ?IUser; } }
namespace OCP\AppFramework\Bootstrap { interface IBootContext {} interface IRegistrationContext {} interface IBootstrap { public function register(IRegistrationContext $context): void; public function boot(IBootContext $context): void; } }
namespace OCP\AppFramework { class App { public function __construct(string $appName, array $urlParams = []) {} } class Controller { public function __construct(string $appName, \OCP\IRequest $request) {} } }
namespace OCP\AppFramework\Http { class DataResponse { public function __construct(private mixed $data = [], private int $status = 200) {} public function getData(): mixed { return $this->data; } public function getStatus(): int { return $this->status; } } }
namespace OCP\AppFramework\Http\Attribute { #[\Attribute] class NoAdminRequired {} }
