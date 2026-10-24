<?php
declare(strict_types=1);

require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Service/OutlineName.php';

use OCA\Outliner\Service\OutlineName;

check('adds extension', fn() => same('Plan.opml', OutlineName::normalize('Plan')));
check('keeps extension', fn() => same('Plan.opml', OutlineName::normalize('Plan.opml')));
check('trims whitespace', fn() => same('Plan.opml', OutlineName::normalize('  Plan  ')));
check('keeps extension case', fn() => same('Plan.OPML', OutlineName::normalize('Plan.OPML')));
check('adds extension to dated name', fn() => same('Notes 2026.opml', OutlineName::normalize('Notes 2026')));
check('rejects slash', fn() => same(null, OutlineName::normalize('a/b')));
check('rejects backslash', fn() => same(null, OutlineName::normalize('a\\b')));
check('rejects dot dot', fn() => same(null, OutlineName::normalize('..')));
check('rejects hidden name', fn() => same(null, OutlineName::normalize('.hidden')));
check('rejects empty name', fn() => same(null, OutlineName::normalize('')));
check('rejects long name', fn() => same(null, OutlineName::normalize(str_repeat('x', 200))));
check('rejects name too long after extension', fn() => same(null, OutlineName::normalize(str_repeat('x', 116))));
check('accepts maximum name', fn() => same(str_repeat('x', 115) . '.opml', OutlineName::normalize(str_repeat('x', 115))));
check('rejects control character', fn() => same(null, OutlineName::normalize("a\x01b")));
