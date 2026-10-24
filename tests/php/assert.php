<?php
declare(strict_types=1);

$GLOBALS['ol_fails'] = 0;
$GLOBALS['ol_runs'] = 0;

function same(mixed $expected, mixed $actual, string $msg = ''): void
{
    if ($expected !== $actual) {
        throw new RuntimeException(($msg !== '' ? $msg . ': ' : '') . 'expected ' . var_export($expected, true) . ' got ' . var_export($actual, true));
    }
}

function check(string $name, callable $fn): void
{
    $GLOBALS['ol_runs']++;
    try {
        $fn();
        echo "ok - $name\n";
    } catch (Throwable $e) {
        $GLOBALS['ol_fails']++;
        echo "not ok - $name: " . $e->getMessage() . "\n";
    }
}

register_shutdown_function(function (): void {
    echo $GLOBALS['ol_runs'] . ' checks, ' . $GLOBALS['ol_fails'] . " failed\n";
    if ($GLOBALS['ol_fails'] > 0 || $GLOBALS['ol_runs'] === 0) {
        exit(1);
    }
});
