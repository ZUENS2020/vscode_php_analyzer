<?php
// 题目5: XXE
// 难度: 中等
// 知识点: XML外部实体注入

highlight_file(__FILE__);

$xml = $_POST['xml'] ?? '';

if(empty($xml)) {
    die("Please POST xml data");
}

$doc = new DOMDocument();
$doc->loadXML($xml, LIBXML_NOENT);

$data = simplexml_import_dom($doc);
echo "Hello, " . $data->name;
