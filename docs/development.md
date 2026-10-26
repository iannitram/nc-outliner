# Development checks

For entry points, module relationships and test coverage, start with [CODEMAP.md](../CODEMAP.md).

The app is a Vue 3 front end (Nextcloud's own components and Vite config) with a PHP page controller. Requirements: Node.js 22.22 or newer (CI uses 24), npm, and PHP 8.4 for the PHP checks (or Docker; see below).

## First-time setup

```sh
npm ci
composer install
```

`npm ci` uses `package-lock.json`. Do not run `npm install` in CI.

## Checks

```sh
npm run lint        # eslint over the sources
npm test            # vitest: mounts src/App.vue and finds "Outlines"
npm run build       # vite build: writes js/nc_outliner-main.mjs and css/nc_outliner-style.css
npm run lint:php    # php -l over appinfo/, lib/, templates/, tests/
npm run test:php    # phpunit over tests/php/
```

`npm run build` writes `js/`, which is generated, git-ignored and skipped by lint. Run it before testing the app in Nextcloud.

## PHP without a local PHP

`lint:php` and `test:php` use a local PHP 8.4 or newer if `php` (or `PHP_BIN`) reports one. If not, they run a throwaway container from the existing `nextcloud:33.0.10-apache` image with the checkout mounted and networking off. Prepare the image once with:

```sh
docker pull nextcloud:33.0.10-apache
```

The checker never pulls an image implicitly. Docker must be running for your account.

## Running the app in a test Nextcloud

Use a throwaway container, never the production Nextcloud or its volumes. Mount this checkout (after `npm run build`) into `custom_apps/nc_outliner`, then:

```sh
occ app:enable nc_outliner
```

Load `/index.php/apps/nc_outliner/` while logged in. The page should show the "Outlines" heading. On any failure, read the Nextcloud log (`occ log:tail` or `data/nextcloud.log`).

On Hyperion, heavy commands (builds, test runs, container runs) go through the dev gate; see `CLAUDE.md`. Deploying into a live Nextcloud needs the owner's approval each time.

## Where things go

- Vue code in `src/`, unit tests in `tests/js/*.test.js`.
- PHP in `lib/` (namespace `OCA\NcOutliner\`), tests in `tests/php/*Test.php`.
- Page template in `templates/`, app metadata and routes in `appinfo/`.
