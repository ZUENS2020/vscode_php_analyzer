<?php
/*
 * 这个文件使用默认的php session处理器
 * 用于触发session反序列化漏洞
 */

error_reporting(0);
// 使用默认的php处理器（不是php_serialize）
// ini_set('session.serialize_handler', 'php');  // 默认就是php

session_start();

echo "<h1>Session Reader</h1>";
echo "<p>This page uses the default 'php' session handler.</p>";
echo "<p>If you've injected a payload in index.php, the deserialization happens here!</p>";

if (isset($_SESSION)) {
    echo "<h2>Session Contents:</h2>";
    echo "<pre>";
    print_r($_SESSION);
    echo "</pre>";
}
?>
