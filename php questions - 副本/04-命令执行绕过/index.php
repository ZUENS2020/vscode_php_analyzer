<?php
/*
 * 题目4: 命令执行绕过
 * 考察点: 命令注入、黑名单绕过、无字母RCE、无参数RCE
 * 难度: 中等
 * Flag: flag{c0mm4nd_1nj3ct10n_byp4ss}
 */

error_reporting(0);
highlight_file(__FILE__);

// Flag存储在 /flag 文件中（需要自己创建）
// echo "flag{c0mm4nd_1nj3ct10n_byp4ss}" > /flag

if (isset($_GET['cmd'])) {
    $cmd = $_GET['cmd'];
    
    // 黑名单过滤
    $blacklist = [
        'flag', 'cat', 'more', 'less', 'head', 'tail', 'tac', 'nl',
        'bash', 'sh', 'nc', 'curl', 'wget', 'php',
        ' ', '\t', '\n', '\r',  // 空白字符
        '\'', '"',  // 引号
        '$', '`',   // 变量和命令替换
        '|', '&', ';',  // 命令连接符
        '>', '<',   // 重定向
        '\\',       // 反斜杠
        '/', '~'    // 路径字符
    ];
    
    foreach ($blacklist as $word) {
        if (stripos($cmd, $word) !== false) {
            die("Blocked: " . htmlspecialchars($word));
        }
    }
    
    // 长度限制
    if (strlen($cmd) > 30) {
        die("Command too long!");
    }
    
    echo "Executing: " . htmlspecialchars($cmd) . "<br>";
    echo "Output:<br><pre>";
    system($cmd);
    echo "</pre>";
} else {
    echo "Please provide a command via ?cmd=<br>";
    echo "Example: ?cmd=id<br>";
    echo "Hint: The flag is at /flag";
}
?>
<?php
/*
Writeup:
这道题过滤非常严格，需要多种技巧组合：

1. 空格绕过：
   - ${IFS} (被$过滤)
   - %09 (Tab，但被过滤)
   - {cmd,arg} 花括号语法
   - < 重定向（被过滤）
   
2. 路径绕过（/被过滤）：
   - 使用当前目录相对路径
   - 使用环境变量：${PATH:0:1} 获取 / (但$被过滤)

3. 关键字绕过：
   - 通配符：fla? fla* [f]lag
   - 转义符：ca\t（反斜杠被过滤）
   - 变量拼接：a=ca;b=t;$a$b（被过滤）
   - Base64：echo xxx|base64 -d|sh（被过滤）
   - 十六进制：$(printf '\x63\x61\x74')（被过滤）

高级解法 - 使用Linux通配符和特殊构造：
由于几乎所有常规方法都被过滤，需要使用极端技巧

方案1：利用通配符读取flag（如果/没被严格过滤）
?cmd=sort%09..%09..%09fla?

方案2：利用base64编码+解码
首先通过可用命令获取base64编码的payload

方案3：使用rev反转命令
echo 'galf/ tac' | rev

实际可行解法（需要根据环境调整）：
由于过滤太严格，可能需要：
1. 利用HTTP请求头注入
2. 利用环境变量
3. 修改题目降低难度

简化版本解法（移除部分过滤后）：
?cmd=ca''t${IFS}/fla''g
?cmd=c\at${IFS}/fl\ag
*/
?>
