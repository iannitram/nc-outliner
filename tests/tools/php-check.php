<?php
declare(strict_types=1);

// Run files in separate processes so standalone tests may define their own stubs.
$mode = $argv[1] ?? 'all';
if (!in_array($mode, ['test', 'lint', 'all'], true)) {
    fwrite(STDERR, "Usage: php tests/tools/php-check.php [test|lint|all]\n");
    exit(2);
}
chdir(dirname(__DIR__, 2));
$files = [];
foreach (['appinfo', 'lib', 'templates', 'tests'] as $directory) {
    $iterator = new RecursiveIteratorIterator(new RecursiveDirectoryIterator($directory, FilesystemIterator::SKIP_DOTS));
    foreach ($iterator as $file) {
        if ($file->isFile() && $file->getExtension() === 'php') {
            $files[] = $file->getPathname();
        }
    }
}
sort($files);
$failed = false;
$count = 0;
foreach ($files as $file) {
    $commands = [];
    if ($mode !== 'test') {
        $commands[] = [PHP_BINARY, '-l', $file];
    }
    if ($mode !== 'lint' && str_starts_with($file, 'tests' . DIRECTORY_SEPARATOR . 'php' . DIRECTORY_SEPARATOR) && str_ends_with($file, '_test.php')) {
        $commands[] = [PHP_BINARY, $file];
        $count++;
    }
    foreach ($commands as $command) {
        $process = proc_open($command, [STDIN, STDOUT, STDERR], $pipes);
        if ($process === false || proc_close($process) !== 0) {
            $failed = true;
        }
    }
}
if ($mode !== 'lint') {
    echo "PHP test files: $count\n";
    if ($count === 0) {
        fwrite(STDERR, "No PHP test files found.\n");
        $failed = true;
    }
}
exit($failed ? 1 : 0);
