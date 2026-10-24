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
| `GET /outlines` | None | Array of OPML paths relative to `Outlines/` |
| `POST /outlines` | `{ name }` | `{ name, etag, document }` for the newly created file |
| `GET /outlines/{name}` | Path with each filename/folder segment URL-encoded, keeping `/` separators | `{ name, etag, document }` |
| `PUT /outlines/{name}` | `{ document }`, strong `If-Match: "etag"` | `{ name, etag }` |
| `GET /outlines-recent` | None | Up to ten existing recent paths for this user |
| `POST /outlines/{name}/relocate` | `{ destination }`, strong `If-Match: "etag"` | `{ name, etag, document }` after rename/move |
| `POST /outlines/{name}/copy` | `{ document }` | `{ name, etag, document }` for a distinct copy |
| `POST /outlines/{name}/export` | `{ document }` | `{ content }`, with OPML XML as a JSON string |
| `GET /theme` | None | `{ theme }` |
| `PUT /theme` | `{ theme }` | `{ theme }` |

The client currently also includes `etag` in save JSON; the controller authorizes overwrites from the header only. Missing, weak, wildcard or multiple ETags cannot authorize the write. A stale/invalid save precondition returns 412. Outline errors map validation to 400, no session to 401, permissions to 403, not found to 404, duplicates/folder collision to 409, lock contention to 423, and other runtime failures to a generic 500 response.

## Files and concurrency

`OutlineFiles` resolves `IRootFolder::getUserFolder()` using `IUserSession`. Its fixed `Outlines/` folder is created on first use. Listings recurse through visible folders and include OPML files. Relative paths reject empty, dot, hidden and `.part` segments, backslashes and control characters; each segment is at most 240 bytes and the final name ends in `.opml`. The `.part` restriction matters because Nextcloud suppresses native hooks for partial-file paths.

Mutations use the native Nextcloud 33 Files API. Its legacy `OC_Filesystem` `write` and `rename` hooks run under shared source/destination locks immediately before the native exclusive upgrade. A scoped listener rechecks destination availability and a freshly fetched source ETag there. Cancellation sets the hook's referenced `run` flag to false and rethrows the captured error after the API returns, since Nextcloud swallows ordinary hook exceptions. The service refuses mutation when the signed-in filesystem context or locking provider is unavailable. Explicit exclusive Node locks cannot wrap these calls because the native API first requests a shared lock.

Save captures its resulting ETag in native `post_write`, while the shared lock is still held, so another writer cannot lend an unseen ETag to the local document. Open and export hold shared locks while reading. A relocation preserves XML bytes through `File::move()`, creates requested parent folders inside `Outlines/`, and refuses replacement of another node. Standard Nextcloud version/cache hooks remain active.

Conflict copies read source XML under a shared lock, apply the supplied local document and create a randomly suffixed filename with the same destination guard. They never write the conflicting original. Recent paths are stored in `outliner/recent` user preferences, capped at ten and filtered against existing outlines. Renaming/moving replaces the old recent path. OPML export writes no file; text and Markdown downloads do not call the server exporter.

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
