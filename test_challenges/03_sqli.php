<?php
// 题目3: SQL注入
// 难度: 中等  
// 知识点: SQL注入绕过

highlight_file(__FILE__);

$conn = new mysqli("localhost", "root", "", "ctf");

$id = $_GET['id'] ?? '1';

// 简单过滤
$id = str_replace(['select', 'union', 'or', 'and'], '', $id);

$sql = "SELECT username FROM users WHERE id = '$id'";
$result = $conn->query($sql);

if($result && $row = $result->fetch_assoc()) {
    echo "User: " . $row['username'];
} else {
    echo "Not found";
}
