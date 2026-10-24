<?php
declare(strict_types=1);

require __DIR__ . '/assert.php';
require __DIR__ . '/../../lib/Odt/OdtBuilder.php';
use OCA\Outliner\Odt\OdtBuilder;
function r(string $id, string $text, array $children = [], string $note = ''): array { return ['id'=>$id,'text'=>$text,'note'=>$note,'children'=>$children]; }
$f1=[r('1','Alpha',[r('2','Beta',[r('3','Gamma')]),r('4','Delta')]),r('5','Echo',[],"n1\nn2")];
$f2=[r('1','A',[r('2','B',[r('3','C',[r('4','D',[r('5','E')])])])])];
$f3=[r('1','A',[r('2','X'),r('3','Y')])];
$f4=[r('1','Tom & Jerry <3',[],'a<b')];
$f5=[r('1','A',[r('2','B',[r('3','C',[],'cn')])])];
$e1='<text:h text:style-name="Heading_20_1" text:outline-level="1">Alpha</text:h><text:h text:style-name="Heading_20_2" text:outline-level="2">Beta</text:h><text:list text:style-name="Bullets"><text:list-item><text:p text:style-name="Standard">Gamma</text:p></text:list-item></text:list><text:list text:style-name="Bullets"><text:list-item><text:p text:style-name="Standard">Delta</text:p></text:list-item></text:list><text:h text:style-name="Heading_20_1" text:outline-level="1">Echo</text:h><text:p text:style-name="Text_20_body">n1<text:line-break/>n2</text:p>';
$e2='<text:h text:style-name="Heading_20_1" text:outline-level="1">A</text:h><text:h text:style-name="Heading_20_2" text:outline-level="2">B</text:h><text:list text:style-name="Bullets"><text:list-item><text:p text:style-name="Standard">C</text:p><text:list><text:list-item><text:p text:style-name="Standard">D</text:p><text:list><text:list-item><text:p text:style-name="Standard">E</text:p></text:list-item></text:list></text:list-item></text:list></text:list-item></text:list>';
$e3='<text:h text:style-name="Heading_20_1" text:outline-level="1">A</text:h><text:list text:style-name="Bullets"><text:list-item><text:p text:style-name="Standard">X</text:p></text:list-item><text:list-item><text:p text:style-name="Standard">Y</text:p></text:list-item></text:list>';
$e4='<text:h text:style-name="Heading_20_1" text:outline-level="1">Tom &amp; Jerry &lt;3</text:h><text:p text:style-name="Text_20_body">a&lt;b</text:p>';
$e5='<text:h text:style-name="Heading_20_1" text:outline-level="1">A</text:h><text:h text:style-name="Heading_20_2" text:outline-level="2">B</text:h><text:list text:style-name="Bullets"><text:list-item><text:p text:style-name="Standard">C</text:p><text:p text:style-name="Text_20_body">cn</text:p></text:list-item></text:list>';
check('F1', fn() => same($e1, OdtBuilder::bodyXml($f1)));
check('F2', fn() => same($e2, OdtBuilder::bodyXml($f2)));
check('F3', fn() => same($e3, OdtBuilder::bodyXml($f3)));
check('F4', fn() => same($e4, OdtBuilder::bodyXml($f4)));
check('F5', fn() => same($e5, OdtBuilder::bodyXml($f5)));
check('empty', fn() => same('', OdtBuilder::bodyXml([])));
check('mimetype', function () use ($f1): void {$p=tempnam(sys_get_temp_dir(),'odt');file_put_contents($p,OdtBuilder::build('My <Plan>',$f1));$z=new ZipArchive();same(true,$z->open($p));same('mimetype',$z->getNameIndex(0));same('application/vnd.oasis.opendocument.text',$z->getFromIndex(0));same(0,$z->statIndex(0)['comp_method']);$z->close();unlink($p);});
check('entries', function () use ($f1): void {$p=tempnam(sys_get_temp_dir(),'odt');file_put_contents($p,OdtBuilder::build('x',$f1));$z=new ZipArchive();same(true,$z->open($p));same(['mimetype','META-INF/manifest.xml','content.xml','styles.xml','meta.xml'],array_map(fn($i)=>$z->getNameIndex($i),range(0,4)));$z->close();unlink($p);});
check('xml', function () use ($f1): void {$p=tempnam(sys_get_temp_dir(),'odt');file_put_contents($p,OdtBuilder::build('My <Plan>',$f1));$z=new ZipArchive();same(true,$z->open($p));foreach(['content.xml','styles.xml','meta.xml','META-INF/manifest.xml']as$n)same(true,(new DOMDocument())->loadXML($z->getFromName($n)));same(true,str_contains($z->getFromName('meta.xml'),'<dc:title>My &lt;Plan&gt;</dc:title>'));$z->close();unlink($p);});
check('styles', function () use ($f1, $e1): void {$p=tempnam(sys_get_temp_dir(),'odt');file_put_contents($p,OdtBuilder::build('x',$f1));$z=new ZipArchive();same(true,$z->open($p));$c=$z->getFromName('content.xml');$s=$z->getFromName('styles.xml');same(true,str_contains($c,$e1));preg_match_all('/text:style-name="([^"]+)"/',$c,$m);foreach(array_unique($m[1])as$x)same(1,preg_match('/style:name="'.preg_quote($x,'/').'"/',$s));$z->close();unlink($p);});
check('controls', fn() => same('<text:h text:style-name="Heading_20_1" text:outline-level="1">ab'."\t".'c</text:h>', OdtBuilder::bodyXml([r('1',"a\x01b\tc")])));
check('display-names', function (): void {$p=tempnam(sys_get_temp_dir(),'odt');file_put_contents($p,OdtBuilder::build('x',[]));$z=new ZipArchive();same(true,$z->open($p));$s=$z->getFromName('styles.xml');same(1,preg_match('/style:name="Text_20_body" style:display-name="Text body"/',$s));same(1,preg_match('/style:name="Heading_20_1" style:display-name="Heading 1"/',$s));same(1,preg_match('/style:name="Heading_20_2" style:display-name="Heading 2"/',$s));$z->close();unlink($p);});
