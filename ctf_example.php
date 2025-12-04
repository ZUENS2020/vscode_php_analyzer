<?php
/**
 * CTF PHP 安全分析示例
 * 包含多个常见漏洞模式和 POP 链
 */

// ============================================================================
// 【1】反序列化漏洞 - 直接使用用户输入
// ============================================================================

class User {
    public $name;
    public $role = 'user';
    public $data;
    
    public function __construct($name = "") {
        $this->name = $name;
    }
}

// 危险点：直接反序列化用户输入
if (isset($_GET['u进我的edge里的GitHub，找到我有一个vscode插件的仓库，同意copilot的pr然后在desktop github里clone下来并安装和测试这个php插件ser'])) {
    $user_data = $_GET['user'];
    $user = unserialize($user_data);  // DESER-001: 用户输入直接传入 unserialize
}

// ============================================================================
// 【2】类型混淆漏洞
// ============================================================================

class LoginValidator {
    public $password = "secret";
    
    public function validate($input) {
        // TYPE-001: 使用松散比较导致类型混淆
        if ($input == $this->password) {
            return true;
        }
        return false;
    }
}

// 类型混淆：0 == "0e123..." 会被认为相等
$validator = new LoginValidator();
if ($validator->validate($_POST['pass'] ?? '')) {
    echo "Login success";
}

// ============================================================================
// 【3】Phar 反序列化 - 文件函数触发
// ============================================================================

class FileHandler {
    public $filename;
    public $content;
    
    public function load() {
        // PHAR-001: 文件函数可触发 phar:// 反序列化
        if (file_exists($this->filename)) {
            $this->content = file_get_contents($this->filename);
        }
    }
}

// 危险：$_GET['file'] 可以是 phar://path/to/file.phar
$file_handler = new FileHandler();
$file_handler->filename = $_GET['file'] ?? 'default.txt';
$file_handler->load();

// ============================================================================
// 【4】魔术方法漏洞 - __destruct 中的危险操作
// ============================================================================

class DatabaseConnection {
    private $host;
    private $user;
    private $password;
    public $query;
    
    public function __construct($host, $user, $password) {
        $this->host = $host;
        $this->user = $user;
        $this->password = $password;
    }
    
    // MAGIC-002: __destruct 包含危险操作
    public function __destruct() {
        // 在对象销毁时执行查询
        if (!empty($this->query)) {
            $this->executeQuery($this->query);
        }
    }
    
    public function executeQuery($sql) {
        // FUNC-005: 动态文件包含
        eval("echo 'Query: " . $sql . "';");
    }
}

// ============================================================================
// 【5】命令执行漏洞
// ============================================================================

class CommandExecutor {
    public $command;
    
    public function run() {
        // FUNC-003: 使用 system 函数执行命令
        system($this->command);
    }
}

if (isset($_GET['cmd'])) {
    $executor = new CommandExecutor();
    $executor->command = $_GET['cmd'];
    $executor->run();
}

// ============================================================================
// 【6】__wakeup 魔术方法漏洞
// ============================================================================

class Session {
    public $user_id;
    public $is_admin = false;
    public $data = [];
    
    public function __wakeup() {
        // MAGIC-001: __wakeup 包含危险操作
        // 可以被绕过，允许设置 is_admin = true
        if ($this->user_id === 1) {
            $this->is_admin = true;
        }
    }
}

// ============================================================================
// 【7】__toString 魔术方法
// ============================================================================

class Logger {
    public $level;
    public $message;
    
    public function __toString() {
        // MAGIC-003: __toString 可触发代码执行
        return "[" . $this->level . "] " . $this->message;
    }
}

class Report {
    public $logger;
    
    public function generate() {
        echo "Report: " . $this->logger;
    }
}

// ============================================================================
// 【8】__call 魔术方法 - 动态方法调用
// ============================================================================

class Gadget {
    public $method;
    public $args;
    
    // MAGIC-004: __call 使用动态方法调用
    public function __call($name, $arguments) {
        // FUNC-004: 可控回调
        return call_user_func($this->method, ...$this->args);
    }
}

// ============================================================================
// 【9】__get 魔术方法
// ============================================================================

class ConfigLoader {
    private $config = [
        'db_host' => 'localhost',
        'db_user' => 'root',
        'flag' => 'CTF{fake_flag}'
    ];
    
    // MAGIC-005: __get 可能包含危险操作
    public function __get($name) {
        if (isset($this->config[$name])) {
            return $this->config[$name];
        }
        return null;
    }
}

// ============================================================================
// 【10】Autoload 利用
// ============================================================================

spl_autoload_register(function($class) {
    // AUTO-001: 存在 autoload 且可能有 unserialize
    $file = __DIR__ . '/' . $class . '.php';
    if (file_exists($file)) {
        include $file;
    }
});

// ============================================================================
// 【11】POP 链示例 - __destruct 触发链
// ============================================================================

class Sink {
    public $cmd;
    
    public function execute() {
        // FUNC-003: 命令执行
        exec($this->cmd);
    }
}

class Middleware {
    public $sink;
    public $method;
    
    public function __destruct() {
        if ($this->sink && $this->method) {
            // 触发 Sink 的方法
            $this->sink->{$this->method}();
        }
    }
}

class EntryPoint {
    public $middleware;
    
    public function __destruct() {
        // 触发 Middleware，形成链
        unset($this->middleware);
    }
}

// ============================================================================
// 【12】序列化点
// ============================================================================

// 序列化点：将对象序列化存储
if (isset($_POST['save_user'])) {
    $user = new User($_POST['name']);
    $serialized = serialize($user);  // 序列化
    // 存储到数据库或文件
    file_put_contents('user_' . $_POST['id'] . '.ser', $serialized);
}

// 反序列化点：从存储读取并反序列化
if (isset($_GET['load_user'])) {
    $user_id = $_GET['load_user'];
    $file = 'user_' . $user_id . '.ser';
    
    if (file_exists($file)) {
        $data = file_get_contents($file);
        // DESER-002: 未使用 allowed_classes 选项
        $user = unserialize($data);  // 危险的反序列化
    }
}

// ============================================================================
// 【13】preg_replace /e 修饰符（已弃用但仍可能存在）
// ============================================================================

class TemplateEngine {
    public $pattern;
    public $replacement;
    public $subject;
    
    public function render() {
        // FUNC-006: preg_replace /e 修饰符（PHP 5.5.0+ 已移除）
        // 仅作为示例展示
        // $result = preg_replace($this->pattern, $this->replacement, $this->subject, -1, $count);
    }
}

// ============================================================================
// 【14】数据流示例 - 用户输入到危险函数
// ============================================================================

class DataProcessor {
    public function process($input) {
        // 数据流：$_GET -> $input -> eval
        $code = "return " . $input . ";";
        // FUNC-001: eval() 使用
        eval($code);
    }
}

if (isset($_GET['data'])) {
    $processor = new DataProcessor();
    $processor->process($_GET['data']);  // 污点数据直接流向 eval
}

// ============================================================================
// 【15】变量追踪示例
// ============================================================================

class VulnerableClass {
    public function trackExample() {
        $user_input = $_GET['name'] ?? '';  // 污点来源
        
        $processed = htmlspecialchars($user_input);  // 清洗（不完全）
        
        $cmd = "echo " . $processed;
        
        // FUNC-003: 变量通过 system 传递给命令执行
        system($cmd);
    }
}

// ============================================================================
// 【16】类分析示例 - 继承和接口
// ============================================================================

interface Exploitable {
    public function exploit();
}

abstract class BaseGadget {
    protected $payload;
    
    abstract public function execute();
}

class RealGadget extends BaseGadget implements Exploitable {
    protected $callback;
    
    public function execute() {
        call_user_func($this->callback);
    }
    
    public function exploit() {
        $this->execute();
    }
}

// ============================================================================
// 【17】assert() 漏洞
// ============================================================================

class AssertVulnerable {
    public function check() {
        $code = $_GET['code'] ?? '';
        
        // FUNC-002: assert() 字符串参数可执行代码
        assert($code);
    }
}

// ============================================================================
// 【18】include/require 动态包含
// ============================================================================

class PageLoader {
    public function loadPage() {
        $page = $_GET['page'] ?? 'home';
        
        // FUNC-005: 动态文件包含
        include("pages/" . $page . ".php");
    }
}

// ============================================================================
// 【19】超级全局变量污点
// ============================================================================

class InputHandler {
    public function handleRequest() {
        // 多个污点来源
        $sources = [
            $_GET['param'],      // GET 参数
            $_POST['data'],      // POST 数据
            $_COOKIE['session'], // Cookie
            $_REQUEST['input'],  // Request
            $_FILES['upload'],   // 文件上传
            $_SERVER['PATH'],    // Server 变量
            $_ENV['USER']        // 环境变量
        ];
        
        foreach ($sources as $input) {
            // 如果直接使用这些输入，会导致漏洞
            // eval($input);  // FUNC-001
            // system($input); // FUNC-003
            // include $input; // FUNC-005
        }
    }
}

// ============================================================================
// 【20】php://input 反序列化
// ============================================================================

class StreamHandler {
    public function handleStream() {
        // 从请求体读取数据
        $raw_input = file_get_contents('php://input');
        
        // DESER-001: 用户输入直接反序列化
        if (!empty($raw_input)) {
            $data = unserialize(base64_decode($raw_input));  // 危险
        }
    }
}

// ============================================================================
// 【21】完整的 POP 链示例
// ============================================================================

/**
 * 这是一个完整的可利用 POP 链示例：
 * 
 * 1. 入口：unserialize($_GET['payload'])
 * 2. EntryPoint.__destruct() 被调用
 * 3. 触发 Middleware.__destruct()
 * 4. Middleware.__destruct() 调用 $sink->method()
 * 5. Sink.execute() 执行命令
 * 
 * 序列化 payload 构造：
 * $chain = new EntryPoint();
 * $chain->middleware = new Middleware();
 * $chain->middleware->sink = new Sink();
 * $chain->middleware->sink->cmd = 'id';
 * $chain->middleware->method = 'execute';
 * echo base64_encode(serialize($chain));
 */

?>
