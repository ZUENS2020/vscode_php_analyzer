<?php
/**
 * Example PHP file for testing the PHP Code Analyzer
 * This demonstrates a typical CTF deserialization challenge
 */

// Example 1: Simple class with magic methods
class Logger {
    private $logFile;
    private $data;
    
    public function __construct($file) {
        $this->logFile = $file;
    }
    
    // Dangerous magic method - called on unserialize
    public function __wakeup() {
        file_put_contents($this->logFile, $this->data);
    }
    
    // Dangerous magic method - called when object is destroyed
    public function __destruct() {
        echo "Logger destroyed\n";
        unlink($this->logFile);
    }
}

// Example 2: Class with __toString
class FileReader {
    private $filename;
    
    public function __construct($file) {
        $this->filename = $file;
    }
    
    // Called when object is used as string
    public function __toString() {
        return file_get_contents($this->filename);
    }
}

// Example 3: Class with __call
class CommandExecutor {
    private $command;
    
    public function __construct($cmd) {
        $this->command = $cmd;
    }
    
    // Called when invoking inaccessible methods
    public function __call($name, $arguments) {
        if ($name === 'execute') {
            system($this->command);
        }
    }
}

// Example 4: POP chain demonstration
class Start {
    private $next;
    
    public function __construct($obj) {
        $this->next = $obj;
    }
    
    public function __destruct() {
        echo $this->next; // Triggers __toString
    }
}

class Middle {
    private $target;
    
    public function __construct($t) {
        $this->target = $t;
    }
    
    public function __toString() {
        $this->target->execute(); // Triggers __call
        return "Done";
    }
}

// Example 5: Dangerous unserialize usage
function processUserData() {
    // DANGEROUS: Unserializing user-controlled data
    if (isset($_GET['data'])) {
        $obj = unserialize($_GET['data']);
        return $obj;
    }
    
    // Also dangerous: data from POST
    if (isset($_POST['serialized'])) {
        $data = unserialize($_POST['serialized']);
        processObject($data);
    }
    
    // Another dangerous pattern
    $userInput = file_get_contents('php://input');
    $result = unserialize($userInput);
    
    return null;
}

// Example 6: Variable tracking demonstration
function trackVariables() {
    $username = "admin";
    $password = "secret123";
    
    // Variable type changes
    $data = "string";
    $data = 123;
    $data = array("key" => "value");
    $data = new Logger("/tmp/log.txt");
    
    // Variable used in different contexts
    echo $username;
    if ($password === "secret123") {
        return $username;
    }
    
    someFunction($username, $password);
}

// Example 7: Potentially exploitable POP chain
$chain = new Start(new Middle(new CommandExecutor("cat /etc/passwd")));
$serialized = serialize($chain);

// This would be exploitable if $serialized is user-controlled
// unserialize($serialized);

// Example 8: Multiple dangerous functions
function dangerousFunctions($input) {
    eval($input); // Very dangerous
    assert($input); // Can execute code
    system($input); // Command execution
    exec($input); // Command execution
    shell_exec($input); // Command execution
}

// Example 9: Class inheritance
class BaseClass {
    protected $value;
    
    public function __construct($v) {
        $this->value = $v;
    }
}

class DerivedClass extends BaseClass {
    private $extra;
    
    public function __wakeup() {
        // Do something dangerous
        file_put_contents("/tmp/hack.txt", $this->value);
    }
}

interface Serializable {
    public function serialize();
    public function unserialize($data);
}

class CustomSerializer implements Serializable {
    private $data;
    
    public function serialize() {
        return serialize($this->data);
    }
    
    public function unserialize($data) {
        $this->data = unserialize($data); // Dangerous!
    }
}

?>
