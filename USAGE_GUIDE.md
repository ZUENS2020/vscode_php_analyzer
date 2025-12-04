# PHP Code Analyzer Usage Guide

This guide provides detailed instructions on using the PHP Code Analyzer extension for CTF challenges.

## Getting Started

1. Install the extension in VS Code
2. Open any PHP file
3. The extension activates automatically for PHP files

## Feature Walkthroughs

### 1. Variable Flow Tracking

**Purpose**: Track how variables are used throughout your code, essential for understanding data flow in deserialization attacks.

**How to use**:
1. Open a PHP file
2. Click on any variable name (e.g., `$data`, `$username`)
3. Right-click and select "Track Variable Flow"
4. The extension will:
   - Highlight all places where the variable is used
   - Show definitions (where it's assigned)
   - Show references (where it's read)
   - Display type changes in the sidebar

**Example**:
```php
$data = $_GET['input'];  // Definition - marked in yellow
echo $data;              // Reference - marked in yellow
$data = unserialize($data); // Type change - shown in sidebar
```

### 2. Class Analysis

**Purpose**: Understand class structure, inheritance, and identify potentially dangerous magic methods.

**How to use**:
1. Select a class name in your code
2. Right-click and choose "Analyze Class Relations"
3. View results in the sidebar:
   - Magic methods (⚠️ for dangerous ones)
   - Properties and their visibility
   - Parent classes and interfaces
   - Object instantiations

**What to look for**:
- `__wakeup`: Called after `unserialize()` - common POP chain entry point
- `__destruct`: Called when object is destroyed - can trigger side effects
- `__toString`: Called when object is used as string - chain gadget
- `__call`: Called for non-existent methods - chain gadget

### 3. Serialization Point Detection

**Purpose**: Find all serialization/deserialization operations and identify dangerous patterns.

**How to use**:
1. Open a PHP file with serialization operations
2. Run command: `PHP Analyzer: Find Serialization Points`
3. Review the sidebar for:
   - All `serialize()` calls
   - All `unserialize()` calls
   - Dangerous points (⚠️ marked in red)

**Dangerous patterns detected**:
- `unserialize($_GET[...])` - user-controlled input
- `unserialize($_POST[...])` - POST data
- `unserialize(file_get_contents(...))` - file input
- Other dangerous functions: `eval()`, `system()`, `exec()`

### 4. POP Chain Detection

**Purpose**: Automatically detect Property-Oriented Programming chains that can be exploited.

**How to use**:
1. Open a PHP file with multiple classes
2. Run command: `PHP Analyzer: Find POP Chain`
3. View detected chains in the sidebar
4. Exploitable chains are marked with ⚠️

**Understanding POP chains**:
A POP chain is a sequence of magic methods that can be chained together:
```
unserialize() → __wakeup() → __toString() → __call() → dangerous_function()
```

**Example chain**:
```php
class Start {
    public function __destruct() {
        echo $this->obj; // Triggers __toString
    }
}

class Middle {
    public function __toString() {
        $this->target->run(); // Triggers __call
    }
}

class End {
    public function __call($name, $args) {
        system($this->cmd); // Dangerous!
    }
}
```

### 5. Magic Methods Overview

**Purpose**: Get a complete list of all magic methods in the current file.

**How to use**:
1. Run command: `PHP Analyzer: Show Magic Methods`
2. View all magic methods grouped by class
3. Dangerous methods are marked with ⚠️

**Common magic methods in CTF**:
- `__construct` - Constructor
- `__destruct` - Destructor (common entry/exit point)
- `__wakeup` - Called after unserialize (entry point)
- `__toString` - String conversion (gadget)
- `__call` - Method overloading (gadget)
- `__get` / `__set` - Property overloading (gadget)

## Real-World CTF Examples

### Example 1: Finding Entry Points

Given a CTF challenge, first find where `unserialize()` is called:

1. Open the PHP file
2. Run "Find Serialization Points"
3. Look for red-highlighted dangerous points
4. Check the data source in the sidebar

### Example 2: Building Exploit Chain

Once you find an entry point:

1. Run "Find POP Chain" to see automatic detection
2. Use "Show Magic Methods" to see all available gadgets
3. Manually trace the chain:
   - Select each class with "Analyze Class Relations"
   - Look for magic methods that call other methods
   - Build your payload based on the chain

### Example 3: Understanding Variable Flow

To understand how data flows:

1. Find the unserialize call
2. Track the variable being unserialized
3. See all places where it's used
4. Identify where the exploit can trigger

## Configuration Options

### Enable/Disable Inline Hints

```json
{
  "phpAnalyzer.enableInlineHints": true
}
```

Shows inline warnings next to dangerous code.

### Highlight Dangerous Patterns

```json
{
  "phpAnalyzer.highlightDangerousPatterns": true
}
```

Automatically highlights dangerous patterns in red.

### Auto POP Chain Detection

```json
{
  "phpAnalyzer.showPOPChains": true
}
```

Automatically detects POP chains on file open.

## Keyboard Shortcuts

You can add custom keyboard shortcuts in VS Code:

1. Open Keyboard Shortcuts (Ctrl+K Ctrl+S)
2. Search for "PHP Analyzer"
3. Assign shortcuts to your favorite commands

Suggested shortcuts:
- `Ctrl+Alt+V` - Track Variable Flow
- `Ctrl+Alt+C` - Analyze Class Relations
- `Ctrl+Alt+P` - Find POP Chain

## Tips and Tricks

### 1. Color Coding
- Yellow highlights = Variable tracking
- Red highlights = Dangerous patterns
- ⚠️ symbol = High priority items

### 2. Sidebar Navigation
- Click on any item in the sidebar to jump to that location
- Expand/collapse sections to focus on what matters

### 3. Multi-file Analysis
- Open multiple PHP files
- Analyze each file separately
- Look for relationships between files

### 4. Common Exploit Patterns

**Pattern 1: Direct unserialize**
```php
unserialize($_GET['data']); // Very dangerous!
```

**Pattern 2: File-based**
```php
unserialize(file_get_contents($_GET['file'])); // Also dangerous
```

**Pattern 3: Cookie-based**
```php
unserialize($_COOKIE['session']); // Often overlooked
```

### 5. POP Gadget Checklist
When building a POP chain, you need:
- [ ] Entry point (`__wakeup` or `__destruct`)
- [ ] Gadgets (`__toString`, `__call`, `__get`, etc.)
- [ ] Sink (dangerous function like `system`, `eval`, `file_put_contents`)

## Troubleshooting

### Extension not activating
- Make sure the file has `.php` extension
- Check VS Code's language mode (bottom right corner)
- Reload window (Ctrl+Shift+P → "Reload Window")

### No results in sidebar
- Make sure you selected a valid variable/class name
- Try running the command from Command Palette (Ctrl+Shift+P)
- Check for syntax errors in your PHP file

### Highlights not showing
- Check configuration: `phpAnalyzer.highlightDangerousPatterns`
- Make sure the code contains trackable patterns
- Try reloading the window

## Advanced Usage

### Analyzing Complex Chains

For complex POP chains:

1. Start with "Show Magic Methods" to see all available gadgets
2. Use "Analyze Class Relations" on each class
3. Manually build the chain based on method calls
4. Verify with "Find POP Chain"

### Custom Pattern Detection

The extension looks for these patterns:
- User input sources: `$_GET`, `$_POST`, `$_REQUEST`, `$_COOKIE`, `$_FILES`
- Dangerous functions: `eval`, `system`, `exec`, `shell_exec`, `passthru`, `assert`
- File operations: `file_get_contents`, `file_put_contents`, `unlink`, `include`, `require`

## Contributing

Found a bug or have a suggestion? Please report it on GitHub!

## License

MIT License - See LICENSE file for details.
