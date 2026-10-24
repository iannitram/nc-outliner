#!/bin/sh
# Run PHP 8.4 (from the local Nextcloud image, in a throwaway container) on a file in this checkout.
# Run: sh tests/tools/php.sh tests/php/some_test.php
export MSYS_NO_PATHCONV=1
root="$(pwd -W 2>/dev/null || pwd)"
exec docker run --rm -v "$root:/w" -w /w nextcloud:33.0.10-apache php "$@"
