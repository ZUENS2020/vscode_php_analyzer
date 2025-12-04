<?php
/*
 * 题目10: Session反序列化
 * 考察点: Session处理器差异、Session反序列化、序列化格式差异
 * 难度: 困难
 * Flag: flag{s3ss10n_d3s3r14l1z3_m4st3r}
 */

error_reporting(0);
?>
<!DOCTYPE html>
<html>
<head><title>Session Manager</title></head>
<body>
<?php
highlight_file(__FILE__);
?>
</body>
</html>
<?php

// 设置session处理器为php_serialize
ini_set('session.serialize_handler', 'php_serialize');
session_start();

class SessionUser {
    public $username;
    public $role;
    public $avatar;
    
    public function __construct($username = 'guest', $role = 'user') {
        $this->username = $username;
        $this->role = $role;
    }
    
    public function __wakeup() {
        echo "<p>Welcome back, {$this->username}!</p>";
    }
    
    public function __destruct() {
        if ($this->role === 'admin') {
            echo "<p><strong>Admin detected!</strong></p>";
        }
    }
}

class FileHandler {
    public $filename;
    public $content;
    
    public function __destruct() {
        if ($this->filename && $this->content) {
            file_put_contents($this->filename, $this->content);
            echo "<p>File written: {$this->filename}</p>";
        }
    }
    
    public function __toString() {
        if (file_exists($this->filename)) {
            return file_get_contents($this->filename);
        }
        return "File not found!";
    }
}

class FlagReader {
    public $source;
    
    public function __toString() {
        $flag = "flag{s3ss10n_d3s3r14l1z3_m4st3r}";
        if ($this->source === 'trusted') {
            return $flag;
        }
        return "Access denied!";
    }
    
    public function __wakeup() {
        $this->source = 'untrusted';  // 重置为不可信
    }
}

// 处理用户输入
if (isset($_POST['data'])) {
    $data = $_POST['data'];
    
    // 过滤危险关键字
    if (preg_match('/FlagReader|FileHandler/i', $data)) {
        die("Dangerous class detected!");
    }
    
    // 存储到session
    $_SESSION['user_data'] = $data;
    echo "<p>Data saved to session!</p>";
}

// 显示当前session数据
if (isset($_SESSION['user_data'])) {
    echo "<p>Current session data: " . htmlspecialchars(substr($_SESSION['user_data'], 0, 100)) . "...</p>";
}
?>

<h2>Session Data Manager</h2>
<form method="POST">
    <textarea name="data" rows="5" cols="50" placeholder="Enter your data..."></textarea><br>
    <input type="submit" value="Save to Session">
</form>

<p>Hint: Check the session.serialize_handler configuration...</p>
<p>Also check reader.php for another entry point...</p>
</body>
</html>
<?php
/*
Writeup:
这道题考察Session反序列化漏洞，利用不同序列化处理器的差异。

背景知识：
PHP有三种session序列化处理器：
1. php：键名|序列化的值（默认）
2. php_serialize：整个$_SESSION数组序列化
3. php_binary：二进制格式

当存储和读取使用不同的处理器时，会产生反序列化漏洞。

漏洞分析：
1. 本页面使用 php_serialize 处理器
2. 如果有另一个页面使用默认的 php 处理器
3. 我们可以注入 | 符号来触发反序列化

攻击原理：
php_serialize格式：a:1:{s:9:"user_data";s:10:"test_value";}
php格式会把 | 前面作为键名，后面作为序列化值

如果我们输入：|O:10:"FlagReader":1:{s:6:"source";s:7:"trusted";}
php_serialize会把整个存储
但php处理器会把|后面的内容反序列化！

攻击步骤：
1. 首先创建另一个处理页面（或找到使用php处理器的页面）
2. 提交包含|的恶意序列化数据
3. 当php处理器解析session时触发反序列化

绕过过滤：
FlagReader 和 FileHandler 被过滤了
可以使用：
1. 十六进制编码类名（在某些版本PHP可用）
2. 大小写变换（本题用了/i，无效）
3. 使用SessionUser类的__destruct，配合其他方法

替代方案 - 使用FileHandler写入Webshell：
虽然FileHandler被过滤，但可以使用十六进制绕过：
\46\69\6c\65\48\61\6e\64\6c\65\72 = FileHandler

或者使用S:（大写S表示转义序列化字符串）：
O:11:"\46ileHandler":2:{...}

实际利用：
需要另一个文件使用默认php处理器来触发

创建 session_reader.php：
<?php
// 使用默认的php处理器
session_start();
// 这里会触发反序列化
?>

Payload（绕过过滤）：
使用Unicode或十六进制：
|O:11:"Fla\x67Reader":1:{s:6:"source";s:7:"trusted";}

或者利用SessionUser类：
|O:11:"SessionUser":3:{s:8:"username";O:10:"FlagReader":1:{s:6:"source";s:7:"trusted";}s:4:"role";s:5:"admin";s:6:"avatar";N;}

由于__wakeup会重置source，需要绕过__wakeup：
修改属性数量（CVE-2016-7124）：
|O:10:"FlagReader":2:{s:6:"source";s:7:"trusted";}
*/
?>
