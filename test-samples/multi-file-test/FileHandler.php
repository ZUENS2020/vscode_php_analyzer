<?php

namespace Test;

require_once 'Base.php';
require_once 'Serializable.php';

/**
 * File handler class with potential vulnerabilities
 */
class FileHandler extends Base implements Serializable {
    private $filename;
    private $mode;

    public function __construct($filename = '', $mode = 'r') {
        parent::__construct();
        $this->filename = $filename;
        $this->mode = $mode;
    }

    public function serialize() {
        return serialize([
            'filename' => $this->filename,
            'mode' => $this->mode
        ]);
    }

    public function unserialize($data) {
        $decoded = unserialize($data);
        $this->filename = $decoded['filename'];
        $this->mode = $decoded['mode'];
    }

    public function __wakeup() {
        // Vulnerable: automatic file reading on deserialization
        if ($this->filename) {
            $this->read();
        }
    }

    public function read() {
        // Dangerous: file_get_contents with user-controlled input
        return file_get_contents($this->filename);
    }

    public function __get($name) {
        if ($name === 'content') {
            return $this->read();
        }
        return null;
    }
}
