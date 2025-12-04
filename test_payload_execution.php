<?php
// Load the classes from ctf_example.php
require_once 'ctf_example.php';

// Get the payload from Untitled-1.php
ob_start();
include 'Untitled-1.php';
$output = ob_get_clean();

// Extract payload from output
preg_match('/Payload \(raw\):\n(.+?)\n\n/s', $output, $matches);
$payload = $matches[1];

echo "Testing payload execution...\n";
echo "Payload: " . substr($payload, 0, 100) . "...\n\n";

// Simulate the unserialize
echo "Executing unserialize...\n";
try {
    $_GET['person'] = $payload;
    $person = unserialize($_GET['person']);
    echo "✓ Unserialize successful\n";
    echo "Object type: " . get_class($person) . "\n";
} catch (Throwable $e) {
    echo "✗ Error: " . $e->getMessage() . "\n";
    echo "  File: " . $e->getFile() . ":" . $e->getLine() . "\n";
}
