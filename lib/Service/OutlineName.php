<?php
declare(strict_types=1);

namespace OCA\Outliner\Service;

final class OutlineName
{
    public static function normalize(string $name): ?string
    {
        $name = trim($name);
        if ($name === '' || strlen($name) > 120 || $name[0] === '.') {
            return null;
        }
        for ($i = 0, $length = strlen($name); $i < $length; $i++) {
            if (ord($name[$i]) < 32 || $name[$i] === '/' || $name[$i] === '\\') {
                return null;
            }
        }
        if (!str_ends_with(strtolower($name), '.opml')) {
            $name .= '.opml';
        }
        return strlen($name) <= 120 ? $name : null;
    }
}
