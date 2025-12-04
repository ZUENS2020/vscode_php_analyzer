<?php
/*
 * 题目9: 变量覆盖与extract
 * 考察点: 变量覆盖、extract()函数、$$可变变量、parse_str()
 * 难度: 中等
 * Flag: flag{v4r14bl3_0v3rwr1t3}
 */

error_reporting(0);
highlight_file(__FILE__);

$flag = "flag{v4r14bl3_0v3rwr1t3}";
$secret_key = "THIS_IS_SUPER_SECRET_KEY_2024";
$admin = false;
$debug = false;

// 危险：使用extract导入用户输入
if (isset($_GET['config'])) {
    $config = $_GET['config'];
    if (is_array($config)) {
        // 过滤掉flag和secret_key
        unset($config['flag']);
        unset($config['secret_key']);
        
        extract($config);
        echo "Configuration loaded.<br>";
    }
}

// 另一个危险点：$$可变变量
if (isset($_GET['key']) && isset($_GET['value'])) {
    $key = $_GET['key'];
    $value = $_GET['value'];
    
    // 黑名单过滤
    $blacklist = ['flag', 'secret_key', 'admin'];
    if (!in_array($key, $blacklist)) {
        $$key = $value;
        echo "Variable \$$key set to: $value<br>";
    } else {
        echo "Blocked variable name!<br>";
    }
}

// 第三个危险点：parse_str
// 注意：PHP 8需要第二个参数，但为了演示漏洞，使用eval模拟旧版行为
if (isset($_GET['query'])) {
    // 模拟PHP 7的parse_str行为（直接创建变量）
    $query_str = $_GET['query'];
    $pairs = explode('&', $query_str);
    foreach ($pairs as $pair) {
        $parts = explode('=', $pair, 2);
        if (count($parts) == 2) {
            $key = urldecode($parts[0]);
            $value = urldecode($parts[1]);
            // 危险：直接创建变量
            $$key = $value;
        }
    }
    echo "Query parsed.<br>";
}

// 检查条件
echo "<br>Current status:<br>";
echo "Admin: " . ($admin ? "Yes" : "No") . "<br>";
echo "Debug: " . ($debug ? "Yes" : "No") . "<br>";

// 获取flag的条件
if ($admin === true && $debug === true) {
    if (isset($auth_token) && $auth_token === $secret_key) {
        echo "<br><strong>Congratulations! Flag: $flag</strong>";
    } else {
        echo "<br>Admin access granted, but authentication token is missing or incorrect.";
        echo "<br>Hint: You need the secret_key as auth_token...";
    }
} else {
    echo "<br>You need admin access and debug mode to get the flag.";
}

echo "<br><br>";
echo "Available parameters:<br>";
echo "- config[]: Load configuration (array)<br>";
echo "- key & value: Set variable<br>";
echo "- query: Parse query string<br>";
?>
<?php
/*
Writeup:
这道题考察多种变量覆盖漏洞：

1. extract() 函数漏洞：
   - extract()会将数组的键值对导入为变量
   - 虽然过滤了flag和secret_key，但可以覆盖admin和debug
   
2. $$可变变量漏洞：
   - $$key = $value 可以创建任意变量
   - 黑名单过滤可以绕过（大小写、特殊字符等）
   
3. parse_str()漏洞：
   - parse_str()会解析查询字符串并创建变量
   - 没有任何过滤，可以覆盖任何变量

攻击步骤：

方案1 - 使用parse_str覆盖所有变量：
?query=admin=1&debug=1&auth_token=THIS_IS_SUPER_SECRET_KEY_2024&secret_key=THIS_IS_SUPER_SECRET_KEY_2024

问题：我们不知道secret_key的值...

方案2 - 使用extract覆盖admin和debug，然后利用$$覆盖其他：
?config[admin]=1&config[debug]=1

然后需要获取secret_key...但被过滤了

方案3 - 利用变量覆盖的顺序：
1. 首先用parse_str设置 secret_key 为我们知道的值
2. 然后设置 auth_token 为同样的值
3. 设置 admin 和 debug 为 true

实际Payload：
?query=secret_key=hacked&auth_token=hacked&admin=1&debug=1

但这样会覆盖原始的secret_key，导致比较失败...

正确思路：
注意代码顺序！
1. extract() 先执行
2. $$ 然后执行  
3. parse_str() 最后执行

关键发现：parse_str()在最后执行，可以覆盖之前所有变量！

最终Payload（利用parse_str覆盖secret_key后再比较）：
由于auth_token === $secret_key的比较在最后
我们可以用parse_str同时覆盖两者为相同值：

?query=admin=1%26debug=1%26secret_key=pwned%26auth_token=pwned

注意：%26是&的URL编码，因为query参数本身需要编码

或者更简单：
?query=admin=true&query2=debug=true（不对，parse_str只调用一次）

正确payload：
?query=admin=1%26debug=1%26auth_token=aaa%26secret_key=aaa

这样 $auth_token = "aaa", $secret_key = "aaa"，比较通过！
*/
?>
