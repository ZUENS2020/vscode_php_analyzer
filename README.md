# PHP Code Analyzer for CTF

A powerful VS Code extension designed specifically for analyzing PHP code in CTF (Capture The Flag) challenges, with a focus on PHP deserialization vulnerabilities and POP (Property-Oriented Programming) chain detection.

## Features

### 🔍 Variable Flow Tracking
- Track variable definitions, assignments, and usage throughout your code
- Highlight all references to a selected variable
- Display variable type changes and transformations
- Visual indicators for variable flow

### 🏗️ Class and Object Analysis
- Display class inheritance trees and interface implementations
- Track object instantiation and property assignments
- Automatically identify PHP magic methods (`__wakeup`, `__destruct`, `__call`, etc.)
- Analyze class relationships and dependencies

### 🔐 Serialization Flow Visualization
- Track `serialize()` and `unserialize()` function calls
- Display serialization data flow paths
- Mark dangerous deserialization points with warnings
- Identify user-controlled data in unserialize operations

### ⚡ Interactive Interface
- Right-click context menu for quick variable tracking
- Dedicated sidebar panel showing analysis results in a tree view
- Inline code hints for dangerous patterns and key information
- Color-coded decorations for different analysis types

### 🎯 CTF-Specific Optimizations
- Detect common deserialization vulnerability patterns
- Display potential POP chain paths
- Highlight exploitable magic method combinations
- Flag dangerous functions (eval, system, exec, etc.)
- Real-time analysis of dangerous code patterns

## Usage

### Track Variable Flow
1. Select a variable in your PHP code
2. Right-click and choose "Track Variable Flow"
3. View all definitions, assignments, and references highlighted
4. Check the sidebar for detailed information

### Analyze Class Relations
1. Select a class name
2. Right-click and choose "Analyze Class Relations"
3. View magic methods, properties, and inheritance information
4. Dangerous magic methods are marked with ⚠️

### Find Serialization Points
1. Open a PHP file
2. Run command: "PHP Analyzer: Find Serialization Points"
3. View all serialize/unserialize calls
4. Dangerous points are highlighted in red

### Detect POP Chains
1. Open a PHP file with multiple classes
2. Run command: "PHP Analyzer: Find POP Chain"
3. View potential exploitation chains in the sidebar
4. Exploitable chains are marked with ⚠️

## Commands

- `PHP Analyzer: Track Variable Flow` - Track a selected variable
- `PHP Analyzer: Analyze Class Relations` - Analyze class structure
- `PHP Analyzer: Find Serialization Points` - Find all serialization calls
- `PHP Analyzer: Find POP Chain` - Detect potential POP chains
- `PHP Analyzer: Show Magic Methods` - Show all magic methods in the file

## Configuration

Access settings via: File > Preferences > Settings > PHP Code Analyzer

- `phpAnalyzer.enableInlineHints`: Enable inline code hints (default: true)
- `phpAnalyzer.highlightDangerousPatterns`: Highlight dangerous patterns (default: true)
- `phpAnalyzer.showPOPChains`: Automatically detect POP chains (default: true)

## Requirements

- VS Code 1.75.0 or higher
- PHP files to analyze

## Extension Settings

This extension contributes the following settings:

* `phpAnalyzer.enableInlineHints`: Enable/disable inline hints for tracked variables
* `phpAnalyzer.highlightDangerousPatterns`: Enable/disable highlighting of dangerous deserialization patterns
* `phpAnalyzer.showPOPChains`: Enable/disable automatic POP chain detection

## Known Issues

- Complex POP chains may not be fully detected
- Analysis is performed on the current file only
- Some edge cases in variable tracking may not be covered

## Release Notes

### 0.1.0

Initial release:
- Variable flow tracking
- Class and object relationship analysis
- Serialization flow visualization
- POP chain detection
- CTF-specific pattern recognition

## Contributing

This extension is designed for security researchers and CTF players. Contributions are welcome!

## License

MIT License - See LICENSE file for details

---

**Enjoy analyzing PHP code for CTF challenges! 🔐**
