<?php
/**
 * CTF Challenge Example - Unsafe Deserialization
 * This file demonstrates various PHP security vulnerabilities
 * that the PHP Code Analyzer can detect
 */

// Vulnerable class with dangerous __destruct
class Logger {
    private $logFile;
    private $logData;

    public function __construct($file) {
        $this->logFile = $file;
        $this->logData = "";
    }

    public function log($message) {
        $this->logData .= $message . "\n";
    }

    // MAGIC-002: Dangerous operation in __destruct
    public function __destruct() {
        // This is dangerous - file path could be controlled
        file_put_contents($this->logFile, $this->logData);
    }
}

// Gadget class with __toString
class User {
    public $name;
    public $isAdmin = false;

    // MAGIC-003: __toString could trigger code execution
    public function __toString() {
        if ($this->isAdmin) {
            // Dangerous: executing system command
            return system("whoami");
        }
        return $this->name;
    }
}

// Another gadget with __call
class DatabaseConnection {
    private $query;

    // MAGIC-004: __call with dynamic method execution
    public function __call($name, $arguments) {
        // FUNC-004: Dangerous callback
        return call_user_func($this->query, $arguments[0]);
    }
}

// Autoload function exists
spl_autoload_register(function($class) {
    include $class . '.php';
});

// DESER-001: Unsafe deserialization with user input
if (isset($_GET['data'])) {
    $data = base64_decode($_GET['data']);
    // CRITICAL: No allowed_classes restriction
    $obj = unserialize($data);
    
    // Trigger __toString
    echo "Welcome: " . $obj;
}

// DESER-001: Another unsafe unserialize
if (isset($_POST['session'])) {
    // User input directly to unserialize
    $session = unserialize($_POST['session']);
}

// FUNC-001: eval() usage
if (isset($_GET['code'])) {
    // CRITICAL: eval with user input
    eval($_GET['code']);
}

// FUNC-003: Command execution
if (isset($_GET['ping'])) {
    $host = $_GET['ping'];
    // Command injection vulnerability
    system("ping -c 1 " . $host);
    exec("nslookup " . $host);
    shell_exec("dig " . $host);
}

// PHAR-001: Phar deserialization via file functions
if (isset($_GET['file'])) {
    $filename = $_GET['file'];
    
    // All of these can trigger phar:// deserialization
    if (file_exists($filename)) {
        $content = file_get_contents($filename);
        $size = getimagesize($filename);
    }
    
    if (is_file($filename)) {
        $data = fopen($filename, 'r');
    }
}

// Safe serialization (for comparison)
$safeData = serialize(['username' => 'admin', 'role' => 'user']);

// Slightly safer unserialize with allowed_classes
if (isset($_GET['safe_data'])) {
    $obj = unserialize($_GET['safe_data'], ['allowed_classes' => ['User']]);
}

// Example POP chain scenario
class FileManager {
    private $file;

    public function setFile($filename) {
        $this->file = $filename;
    }

    public function __destruct() {
        // If $file is controlled, this creates a chain
        if (file_exists($this->file)) {
            // Could trigger phar deserialization
            echo "File exists";
        }
    }
}

// Vulnerability: Type confusion
if ($_GET['admin'] == true) {  // Using == instead of ===
    // TYPE-001: Type confusion vulnerability
    echo "Admin access granted!";
}

// More dangerous functions
if (isset($_GET['assert'])) {
    // FUNC-002: assert with string is dangerous
    assert($_GET['assert']);
}

if (isset($_GET['include'])) {
    // FUNC-005: File inclusion
    include($_GET['include']);
    require($_GET['require']);
}

// Vulnerable to preg_replace /e modifier (older PHP)
if (isset($_GET['pattern'])) {
    // FUNC-006: preg_replace with /e modifier
    preg_replace('/'.$_GET['pattern'].'/e', $_GET['replace'], 'test');
}

?>
