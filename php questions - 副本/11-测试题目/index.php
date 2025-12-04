<?php
// 测试题目：简单的 PHP 反序列化 POP 链
class A {
    public $cmd = 'echo HelloWorld';
    function __destruct() {
        system($this->cmd);
    }
}

if (isset($_GET['pop'])) {
    $obj = unserialize($_GET['pop']);
}
// 访问方式示例：
// ?pop=O:1:"A":1:{s:3:"cmd";s:15:"echo HelloFromCTF";}
