<?php

namespace Test;

/**
 * Database handler with SQL injection vulnerability
 */
class DatabaseHandler {
    private $db;
    private $table;

    public function __construct($table = 'users') {
        $this->table = $table;
    }

    public function query($id) {
        // SQL Injection vulnerability
        $sql = "SELECT * FROM {$this->table} WHERE id = $id";
        return $this->db->query($sql);
    }

    public function insert($data) {
        // Vulnerable to SQL injection
        $columns = implode(',', array_keys($data));
        $values = implode(',', array_values($data));
        $sql = "INSERT INTO {$this->table} ($columns) VALUES ($values)";
        return $this->db->query($sql);
    }

    public function __call($method, $args) {
        if (method_exists($this, $method)) {
            return call_user_func_array([$this, $method], $args);
        }
    }
}
