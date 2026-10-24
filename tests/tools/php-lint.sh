#!/bin/sh
# Syntax-check every PHP file in this checkout with PHP 8.4 (throwaway container from the local Nextcloud image).
export MSYS_NO_PATHCONV=1
root="$(pwd -W 2>/dev/null || pwd)"
exec docker run --rm -v "$root:/w" -w /w nextcloud:33.0.10-apache sh -c '
find appinfo lib templates tests -name "*.php" 2>/dev/null | sort | while read -r f; do
  out=$(php -l "$f" 2>&1) || { echo "$out"; exit 1; }
done && echo lint-ok'
