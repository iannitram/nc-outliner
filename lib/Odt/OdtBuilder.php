<?php
declare(strict_types=1);

namespace OCA\Outliner\Odt;

final class OdtBuilder
{
    public static function bodyXml(array $rows, array $numbering = []): string
    {
        $style = $numbering['style'] ?? 'none';
        $suffix = $numbering['suffix'] ?? '.';
        if (!in_array($style, ['none', 'decimal', 'alpha', 'roman', 'section'], true) || !in_array($suffix, ['.', ')', ':', ''], true)) {
            throw new \InvalidArgumentException('Invalid row numbering.');
        }
        if ($style !== 'none') $rows = self::numberRows($rows, $style, $suffix);
        return self::siblings($rows, 0, false, $style !== 'none');
    }

    /** Canonical document entry point keeps saved numbering with the source. */
    public static function buildDocument(array $document): string
    {
        return self::build($document['title'], $document['rows'], $document['numbering'] ?? []);
    }

    private static function numberRows(array $rows, string $style, string $suffix, array $path = []): array
    {
        $result = [];
        foreach (array_values($rows) as $index => $row) {
            $number = $index + 1;
            $next = [...$path, $number];
            $label = (string)$number;
            if ($style === 'section') $label = implode('.', $next);
            elseif ($style === 'alpha') {
                $label = '';
                for ($n = $number; $n > 0; $n = intdiv($n, 26)) { $n--; $label = chr(97 + $n % 26) . $label; }
            } elseif ($style === 'roman') {
                $label = '';
                foreach ([1000 => 'm', 900 => 'cm', 500 => 'd', 400 => 'cd', 100 => 'c', 90 => 'xc', 50 => 'l', 40 => 'xl', 10 => 'x', 9 => 'ix', 5 => 'v', 4 => 'iv', 1 => 'i'] as $value => $symbol) {
                    while ($number >= $value) { $label .= $symbol; $number -= $value; }
                }
            }
            $row['text'] = $label . $suffix . ' ' . ($row['text'] ?? '');
            $row['children'] = self::numberRows($row['children'] ?? [], $style, $suffix, $next);
            $result[] = $row;
        }
        return $result;
    }

    private static function clean(mixed $value): string
    {
        $s = str_replace("\r\n", "\n", (string)$value);
        $s = preg_replace('/[^\P{C}\n\t]/u', '', $s) ?? '';
        return str_replace("\n", '<text:line-break/>', htmlspecialchars($s, ENT_NOQUOTES | ENT_XML1, 'UTF-8'));
    }

    private static function siblings(array $rows, int $depth, bool $nested, bool $numbered = false): string
    {
        $out = '';
        $i = 0;
        while ($i < count($rows)) {
            $row = $rows[$i];
            $children = is_array($row['children'] ?? null) ? $row['children'] : [];
            $heading = $depth === 0 || ($depth === 1 && count($children) > 0);
            if ($heading) {
                $level = $depth + 1;
                $out .= '<text:h text:style-name="Heading_20_' . $level . '" text:outline-level="' . $level . '">' . self::clean($row['text'] ?? '') . '</text:h>';
                if (($row['note'] ?? '') !== '') $out .= '<text:p text:style-name="Text_20_body">' . self::clean($row['note']) . '</text:p>';
                $out .= self::siblings($children, $depth + 1, false, $numbered);
                $i++;
                continue;
            }
            $out .= '<text:list' . ($nested ? '' : ' text:style-name="' . ($numbered ? 'NumberedRows' : 'Bullets') . '"') . '>';
            while ($i < count($rows)) {
                $row = $rows[$i];
                $children = is_array($row['children'] ?? null) ? $row['children'] : [];
                $isHeading = $depth === 0 || ($depth === 1 && count($children) > 0);
                if ($isHeading) break;
                $out .= '<text:list-item><text:p text:style-name="Standard">' . self::clean($row['text'] ?? '') . '</text:p>';
                if (($row['note'] ?? '') !== '') $out .= '<text:p text:style-name="Text_20_body">' . self::clean($row['note']) . '</text:p>';
                if ($children !== []) $out .= self::siblings($children, $depth + 1, true, $numbered);
                $out .= '</text:list-item>';
                $i++;
            }
            $out .= '</text:list>';
        }
        return $out;
    }

    public static function build(string $title, array $rows, array $numbering = []): string
    {
        $path = tempnam(sys_get_temp_dir(), 'odt');
        if ($path === false) throw new \RuntimeException('Unable to create temporary file');
        $zip = new \ZipArchive();
        if ($zip->open($path, \ZipArchive::CREATE | \ZipArchive::OVERWRITE) !== true) { unlink($path); throw new \RuntimeException('Unable to write zip'); }
        $zip->addFromString('mimetype', 'application/vnd.oasis.opendocument.text');
        $zip->setCompressionName('mimetype', \ZipArchive::CM_STORE);
        $zip->addFromString('META-INF/manifest.xml', self::manifest());
        $ns = 'xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:text="urn:oasis:names:tc:opendocument:xmlns:text:1.0" xmlns:style="urn:oasis:names:tc:opendocument:xmlns:style:1.0" xmlns:fo="urn:oasis:names:tc:opendocument:xmlns:xsl-fo-compatible:1.0"';
        $zip->addFromString('content.xml', '<?xml version="1.0" encoding="UTF-8"?><office:document-content ' . $ns . ' office:version="1.3"><office:automatic-styles/><office:body><office:text>' . self::bodyXml($rows, $numbering) . '</office:text></office:body></office:document-content>');
        $zip->addFromString('styles.xml', self::styles($ns));
        $zip->addFromString('meta.xml', '<office:document-meta xmlns:office="urn:oasis:names:tc:opendocument:xmlns:office:1.0" xmlns:dc="http://purl.org/dc/elements/1.1/" xmlns:meta="urn:oasis:names:tc:opendocument:xmlns:meta:1.0" office:version="1.3"><office:meta><dc:title>' . self::clean($title) . '</dc:title><meta:generator>Outliner</meta:generator></office:meta></office:document-meta>');
        if (!$zip->close()) { unlink($path); throw new \RuntimeException('Unable to write zip'); }
        $bytes = file_get_contents($path); unlink($path);
        if ($bytes === false) throw new \RuntimeException('Unable to read zip');
        return $bytes;
    }

    private static function manifest(): string
    {
        return '<manifest:manifest xmlns:manifest="urn:oasis:names:tc:opendocument:xmlns:manifest:1.0" manifest:version="1.3"><manifest:file-entry manifest:full-path="/" manifest:media-type="application/vnd.oasis.opendocument.text" manifest:version="1.3"/><manifest:file-entry manifest:full-path="content.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="styles.xml" manifest:media-type="text/xml"/><manifest:file-entry manifest:full-path="meta.xml" manifest:media-type="text/xml"/></manifest:manifest>';
    }

    private static function styles(string $ns): string
    {
        $p = '<style:style style:name="Standard" style:family="paragraph"/><style:style style:name="Text_20_body" style:display-name="Text body" style:family="paragraph" style:parent-style-name="Standard"><style:paragraph-properties fo:margin-bottom="0.21cm"/></style:style>';
        foreach ([1 => '18pt', 2 => '14pt'] as $n => $size) $p .= '<style:style style:name="Heading_20_' . $n . '" style:display-name="Heading ' . $n . '" style:family="paragraph" style:parent-style-name="Standard" style:default-outline-level="' . $n . '" style:next-style-name="Text_20_body"><style:text-properties fo:font-size="' . $size . '" fo:font-weight="bold"/><style:paragraph-properties fo:margin-top="0.42cm" fo:margin-bottom="0.21cm" fo:keep-with-next="always"/></style:style>';
        $list = '<text:list-style style:name="Bullets">';
        for ($n=1;$n<=10;$n++) {$x=$n*0.635;$list.='<text:list-level-style-bullet text:level="'.$n.'" text:bullet-char="•"><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="listtab" text:list-tab-stop-position="'.$x.'cm" fo:text-indent="-0.635cm" fo:margin-left="'.$x.'cm"/></style:list-level-properties></text:list-level-style-bullet>';}
        $numbered = '<text:list-style style:name="NumberedRows">';
        for ($n = 1; $n <= 10; $n++) {
            $x = $n * 0.635;
            $numbered .= '<text:list-level-style-number text:level="' . $n . '" style:num-format=""><style:list-level-properties text:list-level-position-and-space-mode="label-alignment"><style:list-level-label-alignment text:label-followed-by="nothing" fo:margin-left="' . $x . 'cm"/></style:list-level-properties></text:list-level-style-number>';
        }
        $numbered .= '</text:list-style>';
        return '<office:document-styles '.$ns.' office:version="1.3"><office:styles>'.$p.$list.'</text:list-style>'.$numbered.'</office:styles></office:document-styles>';
    }
}
