# Change Log

All notable changes to the "PHP Code Analyzer for CTF" extension will be documented in this file.

## [0.1.0] - 2024-12-04

### Added
- Initial release of PHP Code Analyzer for CTF
- Variable flow tracking with definitions, references, and type changes
- Class and object relationship analysis
- Magic method detection (__wakeup, __destruct, __call, etc.)
- Serialization flow visualization
- Dangerous deserialization point detection
- POP chain detection and analysis
- Interactive UI with context menus and sidebar panel
- Inline hints for dangerous patterns
- Color-coded decorations for analysis results
- CTF-specific vulnerability pattern recognition
- Real-time code analysis on document changes

### Features
- Track variable definitions, assignments, and usage
- Display class inheritance trees and interface implementations
- Track object instantiation and property assignments
- Identify PHP magic methods automatically
- Track serialize() and unserialize() calls
- Mark dangerous deserialization points
- Detect potential POP chains
- Highlight exploitable magic method combinations
- Flag dangerous functions (eval, system, exec, etc.)

### Configuration Options
- Enable/disable inline hints
- Enable/disable dangerous pattern highlighting
- Enable/disable automatic POP chain detection
