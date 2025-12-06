<?php

namespace Test;

/**
 * Interface for serializable objects
 */
interface Serializable {
    public function serialize();
    public function unserialize($data);
}
