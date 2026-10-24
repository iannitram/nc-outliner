# Development checks

For entry points, module relationships, API/storage contracts and test coverage, start with [CODEMAP.md](../CODEMAP.md).

The app uses native JavaScript modules and PHP. It has no build step and no npm dependencies. Node.js 22 or newer runs the JavaScript tests:

```sh
npm test
```

Run all available automated checks with:

```sh
npm run check
```

This runs the JavaScript suite, syntax-checks PHP in `appinfo`, `lib`, `templates` and `tests`, and runs each `tests/php/**/*_test.php` file in a separate PHP process. A failed syntax check or test produces a nonzero exit code. It does not enable, install or deploy the app.

PHP checks use PHP 8.4 or newer on your PATH. Set `PHP_BIN` to select a specific executable. If no suitable local PHP is available, checks use a throwaway container from the existing `nextcloud:33.0.10-apache` image. Prepare it once with:

```sh
docker pull nextcloud:33.0.10-apache
```

The container mounts the checkout read-only and has networking disabled. The checker never pulls an image implicitly. Docker must be running and accessible to your account. On Hyperion, follow the dev gate in `CLAUDE.md` for heavy commands.

Individual PHP tasks are also available:

```sh
npm run lint:php
npm run test:php
```

JavaScript tests belong in `tests/js/*.test.mjs`. PHP tests use the `_test.php` suffix in `tests/php/` and must exit nonzero on failure. `tests/php/assert.php` supplies the existing assertion helpers. Tests should exercise behavior and boundaries; they do not require a live Nextcloud account. A passing standalone suite does not replace checking the app inside Nextcloud.

# Page shell

`mountShell(root)` in `js/shell.js` creates labeled navigation, toolbar, editor-content and live-status regions. The returned regions are ordinary DOM elements for feature modules to populate. `destroy()` removes the shell. The template loads `css/shell.css`, which follows the existing Nextcloud theme variables and gives the file browser and editor independent scroll areas. The skip link moves keyboard focus directly into the editor region. Outline text and filenames should be assigned with `textContent`, not HTML.

## Rich text browser check

`node tests/browser/richtext.mjs` runs the committed rich text smoke test against a temporary local HTTP server and real Chromium. It needs Playwright available through `NODE_PATH` (it is optional and is not an app dependency). `CHROMIUM_BIN` defaults to `/usr/bin/chromium`. The check covers topic/note marks, range selection, keyboard and toolbar, typing, history, hostile clipboard HTML, multiline notes and reloading a saved document snapshot. It uses a standalone editor, not a signed-in Nextcloud instance.

Select text in a topic or note and use Bold, Italic, Underline or Strikethrough, or Ctrl/Cmd+B/I/U and Ctrl/Cmd+Shift+X. Empty selections leave the document unchanged. Plain text and Markdown exports retain their existing text-only behavior; OPML preserves formatting annotations.
