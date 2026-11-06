# Installing Outliner

Outliner needs Nextcloud 33 and PHP 8.2 or newer. To build it you need Node 22.22 or newer and git. You don't need Composer, because the app has no PHP packages of its own.

There is one way to install it: build a package, then **replace** the app folder with it. Don't copy a new build over an old folder, and don't reuse a version number.

## 1. Raise the version

Every install of new code needs a new version: `0.1.1` becomes `0.1.2`. Set the same number in both `appinfo/info.xml` (`<version>`) and `package.json` (`"version"`), and commit.

Why: Nextcloud's cache buster for the app's script (`?v=…`) is derived from the version. If the version stays the same, browsers keep running the old cached script after the server has the new one. `npm run package` does not check the version against earlier builds. `npm run install:docker` refuses to replace a server that already runs this version with a different script (unless you pass `--same-version`).

## 2. Build the package

```sh
npm ci
npm run package
```

This builds the app and writes `build/nc_outliner-<version>.tar.gz`, with one `nc_outliner/` folder inside. It stops if the two version numbers differ, or if there are uncommitted changes (new files included). For a throwaway test server, `node tools/package.mjs --allow-dirty` packages uncommitted work.

## 3a. Install into Nextcloud in Docker

```sh
npm run install:docker -- <container>
```

`<container>` is the Nextcloud container's name from `docker ps`. If Nextcloud is not at `/var/www/html` inside it, add `--root <path>` or `--root=<path>`. The path must be absolute and must not contain `..`; any other option or extra argument stops the script before it touches Docker. The script:

1. stops if Nextcloud has another `nc_outliner` folder under `--root` that it could load instead, such as one under `apps/` or a nested `nc_outliner/nc_outliner`. It does not search folders outside `--root` (see `apps_paths` in 3b);
2. stops if the server already runs this version with different code (see step 1; `--same-version` skips this check);
3. deletes `custom_apps/nc_outliner` and unpacks the package in its place, owned by `www-data`;
4. runs `occ upgrade` when the version changed, then `occ app:enable nc_outliner`;
5. checks that Nextcloud loads the app from `custom_apps/nc_outliner`, reports the new version, and finds the script file in that folder identical to this build's (it reads the file on disk; it does not fetch it over HTTP).

It ends with `Done: Nextcloud runs nc_outliner <version> …`. Any other ending says what is wrong.

## 3b. Install by hand (no Docker)

As the web server user, from the Nextcloud folder:

```sh
rm -rf custom_apps/nc_outliner
tar -xzf /path/to/nc_outliner-<version>.tar.gz -C custom_apps
php occ upgrade            # only when the version changed
php occ app:enable nc_outliner
php occ app:getpath nc_outliner   # must print …/custom_apps/nc_outliner
```

Make sure no other `nc_outliner` folder exists under any apps folder (`apps/`, `custom_apps/`, or a path in `apps_paths` in `config.php`).

## If the page looks unstyled

Rows that look like plain text boxes with resize handles, or top-bar buttons stacked down the side, mean the browser is running a script from an older build. Outliner 0.1.1 and later build their styles into the script, so this can't come from a mismatched stylesheet anymore. Check that the version went up (step 1), then reload the page once with Ctrl+Shift+R.
