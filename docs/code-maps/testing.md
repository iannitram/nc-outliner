# Tests and change guide

[Map index](../../CODEMAP.md) · [Frontend](frontend.md) · [Backend](backend.md)

## Commands and runners

| Entry point | What it does |
|---|---|
| `npm test` | Runs `tests/js/*.test.mjs` with Node's test runner. |
| `npm run test:php` | Runs each PHP test file in its own process. |
| `npm run lint:php` | Syntax-checks PHP in `appinfo`, `lib`, `templates` and `tests`. |
| `npm run check` | Runs the JS suite, PHP lint and PHP tests. |
| [php-check.mjs](../../tests/tools/php-check.mjs) | Selects local PHP 8.4+ (or `PHP_BIN`), otherwise the existing pinned Nextcloud Docker image. |
| [php-check.php](../../tests/tools/php-check.php) | Discovers PHP sources and `_test.php` files; separate processes allow independent test stubs. |
| [php.sh](../../tests/tools/php.sh), [php-lint.sh](../../tests/tools/php-lint.sh) | Earlier direct Docker wrappers retained for individual commands. |
| [count-tests.mjs](../../tests/tools/count-tests.mjs) | Enforces a requested minimum count of test declarations. |

The portable Docker runner uses `nextcloud:33.0.10-apache`, mounts the checkout read-only, disables container networking and never pulls implicitly. See [development.md](../development.md) for setup and [CLAUDE.md](../../CLAUDE.md) for machine/deployment rules.

## Coverage map

All paths in the next table are relative to [tests/js](../../tests/js).

| Tests | Main behavior |
|---|---|
| `scaffold.test.mjs` | Package metadata, app registration, theme variables and test-count utility |
| `model.test.mjs`, `editor.test.mjs` | Row identity, text/insertion/deletion, delegated input/keys, focus, history wiring and toolbar integration |
| `history.test.mjs` | Snapshot isolation, undo/redo, limits, reset and shortcut recognition |
| `indent.test.mjs`, `row-actions.test.mjs`, `keyboard.test.mjs` | Subtree preservation, structural boundaries, movement/deletion, keyboard guards, and the full keyboard set |
| `collapse.test.mjs`, `collapse-editor.test.mjs`, `expansion.test.mjs` | Visibility, disclosure controls, recursive actions, focus and combined structural undo |
| `notes.test.mjs`, `checkboxes.test.mjs` | Notes/checklist edits, visibility, retained state, history and persistence notifications |
| `search.test.mjs` | Ancestor paths, collapsed matches, hidden-tree preservation and filtered note caret regression |
| `timestamp.test.mjs` | Locale/timezone formatting, range replacement, notes and metadata preservation |
| `files.test.mjs`, `autosave.test.mjs` | Request options, strong If-Match, debounce, in-flight edits, retry, conflict and lifecycle disposal |
| `import.test.mjs`, `export.test.mjs` | Parsing/validation, create-only workflow, unsaved snapshots, escaping, download lifecycle and failed requests |
| `theme.test.mjs` | Auto inheritance, preference transport, selector state, failure rollback and disposal |

| PHP tests | Main behavior |
|---|---|
| [routes_test.php](../../tests/php/routes_test.php) | Page route scaffold; inspect `appinfo/routes.php` when changing other endpoints |
| [opml_test.php](../../tests/php/opml_test.php) | Codec round trips, extension retention, moves, XML rejection, IDs and notes |
| [checkboxes_test.php](../../tests/php/checkboxes_test.php) | Checklist persistence, hiding and boolean validation |
| [files_test.php](../../tests/php/files_test.php) | User isolation, duplicate protection, paths, locks, ETags, copies and read-only export |
| [autosave_controller_test.php](../../tests/php/autosave_controller_test.php) | Strong/missing/weak/multiple If-Match handling and copy dispatch |
| [theme_test.php](../../tests/php/theme_test.php) | Per-user preferences, defaults, validation and anonymous access |

## Scope and maintenance

JS editor tests use small DOM doubles; they do not establish browser layout or full event behavior. Autosave tests inject timers/transports. PHP tests use standalone Nextcloud interface/service doubles, so passing inside the pinned image verifies PHP runtime behavior, not a running Nextcloud installation.

The latest reviewed feature batch passed 122 JS tests, 31 PHP checks and PHP lint. Separate Chromium workflows exercised the combined app with a mocked HTTP API. Those checks covered import/export, autosave retries and conflicts, page-leave flush, note timestamps, checkboxes, appearance and keyboard actions; they were session-level checks, not a committed live-Nextcloud test harness. See [batch-two-review.md](../batch-two-review.md).

The keyboard set also has a real Chromium smoke at [keyboard-shortcuts-smoke.mjs](../../tests/browser/keyboard-shortcuts-smoke.mjs), covering add inside/outside, indent/outdent, checkbox state, note editing, focus/unfocus, and the help control.

When adding a saved field, check both JS edit/history behavior and PHP XML round trips, including unknown metadata. When changing a save endpoint, check the controller precondition and service lock/write behavior separately. Browser/API checks and any live deployment verification must be reported with their actual environment; standalone tests are not deployment evidence.
