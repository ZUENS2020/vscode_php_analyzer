<?php

namespace Test;

/**
 * Base class with magic methods for POP chain
 */
class Base {
    public $data;
    protected $callback;

    public function __construct($data = null) {
        $this->data = $data;
    }

    public function __destruct() {
        if ($this->callback) {
            call_user_func($this->callback, $this->data);
        }
    }

    public function __toString() {
        return $this->process();
    }

    protected function process() {
        if ($this->data instanceof Serializable) {
            return $this->data->serialize();
        }
        return (string)$this->data;
    }
}
