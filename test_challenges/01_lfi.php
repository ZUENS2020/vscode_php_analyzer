<?php
// 题目1: 文件包含 + PHP伪协议
// 难度: 中等
// 知识点: LFI、php://filter

highlight_file(__FILE__);

$file = $_GET['file'] ?? 'welcome.php';

// 过滤了一些关键字
if(strpos($file, 'flag') !== false) {
    die('No flag for you!');
}

include($file);

// flag.php 内容:
// <?php $flag = 'flag{php_filter_base64}'; ?>
