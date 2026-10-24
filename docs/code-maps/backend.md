# Backend and storage code map

[Map index](../../CODEMAP.md) · [Frontend](frontend.md) · [Tests](testing.md)

## Registration and request path

[appinfo/info.xml](../../appinfo/info.xml) declares app ID `outliner`, namespace `OCA\Outliner`, Nextcloud 33 compatibility and navigation. [Application.php](../../lib/AppInfo/Application.php) supplies the app bootstrap and ID constant. [appinfo/routes.php](../../appinfo/routes.php) is the route source of truth.

| File | Responsibility |
|---|---|
| [PageController.php](../../lib/Controller/PageController.php) | Returns the page template and generated asset/API URLs for the signed-in session. |
| [OutlineController.php](../../lib/Controller/OutlineController.php) | JSON outline endpoints, strong `If-Match` parsing and common error/status mapping. |
| [OutlineFiles.php](../../lib/Service/OutlineFiles.php) | User-folder resolution, filename validation, Files API operations, locks, ETag guard, copies and export. |
| [Opml.php](../../lib/Service/Opml.php) | OPML creation, parsing, validation and metadata-preserving reconstruction. |
| [ThemeController.php](../../lib/Controller/ThemeController.php) | JSON preference reads/writes and preference error responses. |
| [ThemePreferences.php](../../lib/Service/ThemePreferences.php) | Validates `auto`/`light`/`dark` and stores `outliner/theme` through `IConfig` for the session user. |

The API base is generated from the app page URL plus `/api`; browser code must not hardcode a Nextcloud installation webroot. Routes below are relative to that base. API methods carry `NoAdminRequired`; normal Nextcloud authentication/CSRF handling still applies. Browser callers send the request token.

## API contracts

| Method and suffix | Input | Success payload |
|---|---|---|
| `GET /outlines` | None | Array of OPML filenames |
| `POST /outlines` | `{ name }` | `{ name, etag, document }` for the newly created file |
| `GET /outlines/{name}` | URL-encoded basename | `{ name, etag, document }` |
| `PUT /outlines/{name}` | `{ document }`, strong `If-Match: "etag"` | `{ name, etag }` |
| `POST /outlines/{name}/copy` | `{ document }` | `{ name, etag, document }` for a distinct copy |
| `POST /outlines/{name}/export` | `{ document }` | `{ content }`, with OPML XML as a JSON string |
| `GET /theme` | None | `{ theme }` |
| `PUT /theme` | `{ theme }` | `{ theme }` |

The client currently also includes `etag` in save JSON; the controller authorizes overwrites from the header only. Missing, weak, wildcard or multiple ETags cannot authorize the write. A stale/invalid save precondition returns 412. Outline errors map validation to 400, no session to 401, permissions to 403, not found to 404, duplicates/folder collision to 409, lock contention to 423, and other runtime failures to a generic 500 response.

## Files and concurrency

`OutlineFiles` resolves `IRootFolder::getUserFolder()` using `IUserSession`. Its fixed `Outlines/` folder is created on first use. Listings include files only, not folders with an `.opml` suffix. Filenames must be nonempty OPML basenames, at most 240 bytes, without paths, leading dots or control characters.

Create holds an exclusive folder lock, checks `nodeExists()`, then calls `newFile()`. This check matters because Nextcloud's `newFile()` can overwrite an existing file. Open holds a shared file lock while reading the ETag and content. Save holds an exclusive file lock across ETag comparison, codec serialization and `putContent()`. Locks are released in `finally` blocks.

Conflict copies read source XML under a shared lock, apply the supplied local document, then create a randomly suffixed filename under an exclusive folder lock. They never write the conflicting original. OPML export also serializes against the original XML under a shared lock, but writes no file. Text and Markdown downloads do not call the server exporter.

## Document and OPML mapping

The JavaScript document has `title`, `rows`, and optional `showCheckboxes`. Each nested row has `id`, `text`, `children` and `collapsed`, plus optional `note`, `noteVisible` and `checked`.

The extension namespace is `https://nextcloud.com/ns/outliner/1`, conventionally prefixed `nc`.

| In-memory field | XML location |
|---|---|
| `document.title` | `opml/head/title` text |
| `document.rows` | Nested `outline` elements in `opml/body` |
| `document.showCheckboxes` | Root `nc:showCheckboxes` boolean |
| `row.id` | `outline/@nc:id` |
| `row.text` | `outline/@text` |
| `row.collapsed` | `outline/@nc:collapsed` boolean |
| `row.note` | `outline/@nc:note` string |
| `row.noteVisible` | `outline/@nc:note-visible` boolean |
| `row.checked` | `outline/@nc:checked` boolean |

Optional fields are read when their attributes exist and written when supplied. New client rows receive UUID-style identities. Legacy rows without an ID receive a deterministic position-derived ID while reading; a subsequent write persists it. Duplicate IDs are rejected.

`Opml::write(document, original)` indexes original rows by ID, clones their XML, replaces known text/state/child structure, and preserves unknown attributes and non-outline XML. Head metadata also survives. Unknown XML is not sent as arbitrary JSON extension fields; new persistent fields need explicit read/write support.

XML parsing rejects DOCTYPE/entity declarations, malformed OPML, and input above 5 MiB, and uses `LIBXML_NONET`. Writes validate required document/row types, unique IDs matching `[A-Za-z0-9_-]{1,128}`, at most 10,000 rows and recursion depth no greater than 100. The emitted XML is parsed again before use. Future column, style or rich-text support must extend this codec deliberately.

## Row numbering

`Opml` maps document `numbering: { style, suffix }` to namespaced root attributes `nc:numbering-style` and `nc:numbering-suffix`. Style is none/decimal/alpha/roman/section; suffix is period/closing parenthesis/colon/empty. Legacy files default to no numbering in the editor. Unknown XML remains preserved.

Publishers should call `OdtBuilder::buildDocument($document)` to retain saved numbering. The legacy `build($title, $rows)` signature remains supported with an optional third settings argument. Labels derive from all sibling positions, including collapsed rows, and appear in heading/list text; a markerless list style avoids duplicate bullets while retaining indentation. Notes are not numbered. The current base contains the builder without the F07 publishing endpoint.
