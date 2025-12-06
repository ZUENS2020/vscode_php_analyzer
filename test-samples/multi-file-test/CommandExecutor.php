<?php

namespace Test;

require_once 'Base.php';

/**
 * Command executor with dangerous functions
 */
class CommandExecutor extends Base {
    private $command;
    private $args;

    public function __construct($cmd = '') {
        parent::__construct();
        $this->command = $cmd;
        $this->args = [];
    }

    public function setArgs($args) {
        $this->args = $args;
    }

    public function __invoke() {
        // Dangerous: executing system commands
        $fullCommand = $this->command . ' ' . implode(' ', $this->args);
        return system($fullCommand);
    }

    public function __toString() {
        // Triggers __invoke
        return (string)$this();
    }

    public function execute() {
        // Another dangerous function
        return shell_exec($this->command);
    }

    public function runEval($code) {
        // Extremely dangerous
        eval($code);
    }
}
