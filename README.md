# PHP Security Analyzer

[中文](README_zh-CN.md) | English

🔒 A PHP security analysis plugin designed for CTF competitions, featuring automatic vulnerability detection, POP chain analysis, and exploit payload generation.

![VS Code](https://img.shields.io/badge/VS%20Code-^1.80.0-blue)
![License](https://img.shields.io/badge/license-MIT-green)
![Version](https://img.shields.io/badge/version-1.0.0-orange)

## ✨ Features

### 🔍 Vulnerability Detection
- **LFI/RFI** - Local/Remote File Inclusion
- **SQL Injection** - Including intval bypass detection
- **XXE** - XML External Entity Injection
- **Command Injection** - system/exec/passthru, etc.
- **Deserialization** - Dangerous unserialize calls
- **SSRF** - Server-Side Request Forgery
- **Variable Override** - extract/parse_str, etc.

### ⛓️ POP Chain Analysis
- Automatic magic method detection (__destruct, __wakeup, __toString, etc.)
- Property injection point tracking
- Complete attack chain construction
- Visualized call relationship display

### 📊 Code Structure Graph
- Maltego-style interactive charts
- Class/method/property relationship visualization
- Data flow tracking
- Dangerous function call highlighting

### 🎯 Payload Generation
- Automatic vulnerability exploit code generation
- POP chain serialization payload support
- Multiple bypass techniques provided

## 📦 Installation

### Install from VSIX
```bash
code --install-extension php-code-analyzer-ctf-x.x.x.vsix
```

### Build from Source
```bash
git clone https://github.com/ZUENS2020/vscode_php_analyzer.git
cd vscode_php_analyzer
npm install
npm run compile
npx vsce package
```

## 🚀 Usage

1. Open a PHP file
2. Use the Command Palette (`Ctrl+Shift+P`):
   - `PHP Analyzer: Full Security Analysis` - Complete security analysis
   - `PHP Analyzer: Find POP Chain` - Find POP chains
   - `PHP Analyzer: Scan Vulnerabilities` - Scan for vulnerabilities
   - `PHP Analyzer: Generate Exploit Payload` - Generate exploit code
   - `PHP Analyzer: Show Code Graph` - Show code structure graph

3. Right-click menu also provides quick access to analysis functions

## 📸 Screenshots

### Code Structure Graph
Interactive chart displaying code structure and attack paths:
- 🟢 Entry points (unserialize)
- 🔵 Classes
- 🟢 Methods
- 🔴 Magic methods
- 🟠 User input sources
- 🔴 Dangerous functions

### POP Chain Detection
Automatically discovers deserialization attack chains and generates payloads.

## ⚙️ Configuration

Search for `phpAnalyzer` in VS Code settings:

| Setting | Default | Description |
|---------|---------|-------------|
| `phpAnalyzer.enableInlineHints` | true | Show inline hints |
| `phpAnalyzer.highlightDangerousPatterns` | true | Highlight dangerous code |
| `phpAnalyzer.showPOPChains` | true | Show POP chains |
| `phpAnalyzer.graphServerPort` | 3000 | Graph server port |

## 🔧 Development

```bash
# Install dependencies
npm install

# Compile
npm run compile

# Watch mode
npm run watch

# Package
npx vsce package
```

Press `F5` to launch debug mode.

## 📝 Changelog

### v1.0.0
- First official release
- Complete vulnerability detection features
- Automatic POP chain analysis
- Maltego-style code structure graph
- Automatic payload generation

## 📄 License

MIT License

## 🤝 Contributing

Issues and Pull Requests are welcome!

---

**⚠️ Disclaimer: This tool is for security research and CTF learning only. Do not use for illegal purposes.**
