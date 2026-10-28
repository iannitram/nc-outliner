# Development checks

For entry points, module relationships and test coverage, start with [CODEMAP.md](../CODEMAP.md).

The app is a Vue 3 front end (Nextcloud's own components and Vite config) with a PHP page controller. Requirements: Node.js 22.22 or newer (CI uses 24), npm, and PHP 8.4 for the PHP checks (or Docker; see below).

## First-time setup

```sh
npm ci
```

Install PHP dependencies with Composer. `composer install` is the normal path when Composer runs under PHP 8.4 with the required extensions. If Composer is unavailable locally, download the official installer and verify its published SHA-384 signature before using the project's Nextcloud PHP image (PHP 8.4, including the required extensions). From the repository root, with Docker running:

```sh
(
  set -eu
  curl -fsSL https://composer.github.io/installer.sig -o composer-setup.sig
  curl -fsSL https://getcomposer.org/installer -o composer-setup.php
  docker run --rm --entrypoint php -v "$PWD:/app" -w /app \
    nextcloud:33.0.10-apache -r '
      $expected = trim(file_get_contents("composer-setup.sig"));
      if (!hash_equals($expected, hash_file("sha384", "composer-setup.php"))) {
          fwrite(STDERR, "Composer installer checksum mismatch\n");
          exit(1);
      }
    '
  docker run --rm --entrypoint php -v "$PWD:/app" -w /app \
    nextcloud:33.0.10-apache composer-setup.php --quiet --filename=composer.phar
  rm composer-setup.php composer-setup.sig
)

mkdir -p .cache/composer

docker run --rm --entrypoint php \
  -v "$PWD:/workspace/nc-outliner" \
  -v "$PWD/composer.phar:/workspace/composer.phar:ro" \
  -v "$PWD/.cache/composer:/workspace/.cache/composer" \
  -e COMPOSER_HOME=/workspace/.cache/composer \
  -e COMPOSER_CACHE_DIR=/workspace/.cache/composer/cache \
  -w /workspace/nc-outliner \
  nextcloud:33.0.10-apache \
  /workspace/composer.phar install --no-interaction --prefer-dist
```

The setup uses `curl` and Docker; it does not require a host PHP or Composer executable. A checksum failure stops before running the installer. The PHAR and `.cache/` are local tools and cache; do not commit them. If your network uses a custom HTTPS certificate authority, mount its CA bundle read-only in each networked container and set PHP’s `openssl.cafile`, `curl.cainfo`, and `COMPOSER_CAFILE` to that path; keep certificate verification enabled.

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

Use a throwaway container, never a live Nextcloud or its volumes. Mount this checkout (after `npm run build`) into `custom_apps/nc_outliner`, then:

```sh
occ app:enable nc_outliner
```

Load `/index.php/apps/nc_outliner/` while logged in. The page should show the "Outlines" heading. On any failure, read the Nextcloud log (`occ log:tail` or `data/nextcloud.log`).

Deploy to a live Nextcloud only with the maintainer's approval.

## Where things go

- Vue code in `src/`, unit tests in `tests/js/*.test.js`.
- PHP in `lib/` (namespace `OCA\NcOutliner\`), tests in `tests/php/*Test.php`.
- Page template in `templates/`, app metadata and routes in `appinfo/`.
