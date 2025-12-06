<?php

namespace Test;

require_once 'FileHandler.php';
require_once 'CommandExecutor.php';
require_once 'DatabaseHandler.php';

/**
 * Main application with multiple vulnerabilities
 */
class Application {
    private $fileHandler;
    private $cmdExecutor;
    private $dbHandler;

    public function __construct() {
        $this->fileHandler = new FileHandler();
        $this->cmdExecutor = new CommandExecutor();
        $this->dbHandler = new DatabaseHandler();
    }

    public function handleRequest() {
        // Vulnerable: using user input directly
        if (isset($_GET['file'])) {
            $this->fileHandler = new FileHandler($_GET['file']);
        }

        if (isset($_GET['cmd'])) {
            $this->cmdExecutor = new CommandExecutor($_GET['cmd']);
        }

        // Vulnerable: extract() can overwrite variables
        if (isset($_POST['data'])) {
            extract($_POST['data']);
        }

        // Vulnerable: unserialize user input
        if (isset($_COOKIE['session'])) {
            $session = unserialize($_COOKIE['session']);
        }

        // Vulnerable: dynamic variable names
        if (isset($_GET['var'])) {
            $$_GET['var'] = $_GET['value'];
        }
    }

    public function processXML($xml) {
        // XXE vulnerability
        $doc = simplexml_load_string($xml);
        return $doc;
    }

    public function makeRequest($url) {
        // SSRF vulnerability
        return file_get_contents($url);
    }

    public function loadPhar($path) {
        // Phar deserialization vulnerability
        include("phar://" . $path);
    }
}
