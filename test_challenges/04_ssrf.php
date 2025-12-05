<?php
// 题目4: SSRF
// 难度: 中等
// 知识点: SSRF内网探测

highlight_file(__FILE__);

$url = $_GET['url'] ?? '';

if(empty($url)) {
    die("Please provide a url parameter");
}

// 简单检查
if(preg_match('/127\.0\.0\.1|localhost/i', $url)) {
    die("Blocked!");
}

$content = file_get_contents($url);
echo $content;
