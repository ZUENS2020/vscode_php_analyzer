# Change Log

All notable changes to the "PHP Code Analyzer for CTF" extension will be documented in this file.

## [0.2.0] - 2025-12-04

### Added
- **Variable Flow Tracking**: Track variables through definitions, assignments, and references
- **Class Relation Analysis**: Analyze class structure, inheritance, and interfaces
- **Magic Method Detection**: Find and analyze PHP magic methods with danger assessment
- **Serialization Point Discovery**: Detect serialize/unserialize calls with safety analysis
- **POP Chain Detection**: Automatically find Property-Oriented Programming chains
- **Attack Chain Analysis**: Comprehensive attack vector detection with risk scoring
- **Vulnerability Scanner**: 20+ vulnerability patterns across multiple categories
- **Exploit Payload Generator**: Auto-generate exploitation code for detected chains
- **Full Security Analysis**: One-click comprehensive security assessment
- **Code Graph Visualization**: Interactive SVG graphs showing code structure
- **Inheritance Graph**: Visual class hierarchy representation
- **Data Flow Graph**: Track data from sources to sinks
- **Tree View Results**: Organized display of analysis findings
- **Context Menu Integration**: Quick access to common commands
- **Editor Title Button**: One-click full analysis from toolbar
- **Configurable Settings**: 6 user-configurable options
- **Progress Notifications**: Real-time feedback during analysis

### Vulnerability Patterns
- DESER-001: Unsafe Deserialization
- DESER-002: Missing allowed_classes
- FUNC-001: eval() Usage
- FUNC-003: Command Execution Functions
- FUNC-004: Dangerous Callbacks
- MAGIC-002: Dangerous __destruct Method
- PHAR-001: Phar Deserialization Vulnerabilities

### Features
- Support for all PHP magic methods
- User input source tracking ($_GET, $_POST, etc.)
- Dangerous function detection (eval, system, exec, etc.)
- Phar wrapper detection in file operations
- Risk level classification (Critical/High/Medium/Low)
- Exploitability scoring (0-100%)
- Detailed remediation guidance
- CWE mapping for vulnerabilities

### UI Components
- PHP Security Analyzer sidebar
- Analysis Results tree view
- Code Graph webview with zoom/pan
- Hover tooltips with details
- Click-to-navigate to source code
- Severity-based color coding

### Configuration Options
- phpAnalyzer.enableInlineHints
- phpAnalyzer.highlightDangerousPatterns
- phpAnalyzer.showPOPChains
- phpAnalyzer.autoAnalyzeOnOpen
- phpAnalyzer.maxChainDepth
- phpAnalyzer.showGraphOnAnalysis

## [0.1.0] - Initial Development
- Project setup and architecture design
- Core PHP parser integration
- Basic AST traversal functionality

---

## Future Planned Features

### Version 0.3.0
- [ ] Taint analysis for more accurate data flow
- [ ] Custom vulnerability pattern definitions
- [ ] Export analysis reports (PDF/HTML)
- [ ] Integration with PHP-CS-Fixer
- [ ] Advanced payload customization
- [ ] Multi-file analysis support

### Version 0.4.0
- [ ] Machine learning for gadget chain discovery
- [ ] Integration with CVE databases
- [ ] Real-time analysis while typing
- [ ] Collaborative analysis sharing
- [ ] Plugin system for custom analyzers

---

Check [Keep a Changelog](http://keepachangelog.com/) for more information.
