<?php
// 题目6: 反序列化漏洞
// 难度: 中等
// 知识点: PHP对象注入, POP链

highlight_file(__FILE__);

class Logger {
    public $file;
    public $content;
    
    public function __destruct() {
        // 危险: 直接写入文件
        file_put_contents($this->file, $this->content);
    }
}

class Executor {
    public $cmd;
    
    public function __destruct() {
        // 危险: 命令执行
        system($this->cmd);
    }
}

class Wrapper {
    public $obj;
    public $method;
    
    public function __wakeup() {
        // 触发 __toString
        echo $this->obj;
    }
    
    public function __toString() {
        // 调用任意方法
        $m = $this->method;
        return $this->obj->$m();
    }
}

$data = $_GET['data'] ?? '';
if (!empty($data)) {
    // 漏洞: 直接反序列化用户输入
    $obj = unserialize(base64_decode($data));
    echo "Object loaded!";
}

// 正确做法:
// $obj = unserialize($data, ['allowed_classes' => ['SafeClass']]);
