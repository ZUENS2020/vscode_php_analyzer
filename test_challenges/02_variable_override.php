<?php
// 题目2: 变量覆盖
// 难度: 简单
// 知识点: extract() 变量覆盖

highlight_file(__FILE__);

$admin = false;
$auth = 0;

extract($_GET);

if($admin && $auth === 1) {
    include('flag.php');
    echo $flag;
} else {
    echo "You are not admin!";
}
