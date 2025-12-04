# Installation and Testing Guide

## How to Test the Extension

### Option 1: Run in Extension Development Host

1. Open VS Code
2. Open the project folder: `/home/runner/work/vscode_php_highlighter/vscode_php_highlighter`
3. Press `F5` to launch Extension Development Host
4. In the new window, open the `test.php` file
5. Try the commands:
   - Press `Ctrl+Shift+P` and type "PHP Analyzer"
   - Right-click in the PHP file
   - Click the rocket icon in the editor toolbar

### Option 2: Package and Install

```bash
# Install vsce (VS Code extension packager)
npm install -g @vscode/vsce

# Package the extension
cd /home/runner/work/vscode_php_highlighter/vscode_php_highlighter
vsce package

# Install the generated .vsix file
code --install-extension php-code-analyzer-ctf-0.2.0.vsix
```

## Testing Each Feature

### 1. Track Variable Flow
1. Open `test.php`
2. Select the variable `$data` on line 55
3. Right-click → "Track Variable Flow"
4. Check the sidebar for definitions, assignments, and references

### 2. Analyze Class Relations
1. Select class name `Logger` 
2. Right-click → "Analyze Class Relations"
3. View class structure in sidebar

### 3. Show Magic Methods
1. Press `Ctrl+Shift+P`
2. Type "PHP Analyzer: Show Magic Methods"
3. View all magic methods with danger warnings

### 4. Find Serialization Points
1. Run "PHP Analyzer: Find Serialization Points"
2. See dangerous unserialize calls highlighted

### 5. Find POP Chain
1. Run "PHP Analyzer: Find POP Chain"
2. View detected chains from __destruct to dangerous functions

### 6. Full Security Analysis
1. Click the rocket 🚀 icon in editor toolbar
2. Wait for progress notification
3. View comprehensive results in sidebar
4. Code graph automatically appears

### 7. Analyze Attack Chains
1. Right-click → "Analyze Attack Chains"
2. View complete attack vectors with risk levels
3. See Critical/High/Medium/Low classifications

### 8. Scan Vulnerabilities
1. Run "PHP Analyzer: Scan Vulnerabilities"
2. View all detected vulnerability patterns
3. Check CWE mappings and remediation advice

### 9. Generate Exploit Payload
1. First run "Analyze Attack Chains"
2. Run "PHP Analyzer: Generate Exploit Payload"
3. Select an attack chain from the list
4. View generated PHP exploit code

### 10. Show Code Graph
1. Run "PHP Analyzer: Show Code Graph"
2. View interactive graph in sidebar
3. Zoom with +/- buttons
4. Click nodes to jump to code

### 11. Show Inheritance Graph
1. Run "PHP Analyzer: Show Inheritance Graph"
2. View class hierarchy

### 12. Show Data Flow Graph
1. Run "PHP Analyzer: Show Data Flow Graph"
2. View sources and sinks

## Expected Results with test.php

The test file contains intentional vulnerabilities that should be detected:

✅ **Critical Vulnerabilities:**
- DESER-001: Unsafe unserialize on lines 55, 63
- FUNC-001: eval() on line 68
- FUNC-003: Command execution on lines 74-76

✅ **High Severity:**
- MAGIC-002: Dangerous __destruct in Logger class
- PHAR-001: Phar deserialization on lines 82-91
- FUNC-004: Dangerous callbacks

✅ **Magic Methods Found:**
- Logger::__destruct (⚠️ DANGEROUS)
- User::__toString (⚠️ DANGEROUS)
- DatabaseConnection::__call (⚠️ DANGEROUS)
- FileManager::__destruct (⚠️ DANGEROUS)

✅ **Attack Chains:**
- Unsafe Deserialization → Object Injection
- Phar Deserialization → Gadget Chain
- Direct Command Injection

✅ **POP Chains:**
- Logger::__destruct → file_put_contents
- User::__toString → system()
- FileManager::__destruct → file_exists → phar://

## Troubleshooting

### Extension doesn't activate
- Make sure you're opening a .php file
- Check VS Code version is 1.80.0+

### Commands not appearing
- Reload window: `Ctrl+Shift+P` → "Reload Window"
- Check activation events in package.json

### Graph not showing
- Check webview is enabled in settings
- Try resetting zoom in graph view

### Compilation errors
```bash
npm run compile
```
Check for TypeScript errors

## Configuration

Access settings in VS Code:
1. `File` → `Preferences` → `Settings`
2. Search for "PHP Analyzer"
3. Adjust settings as needed

### Recommended Settings for Testing

```json
{
  "phpAnalyzer.enableInlineHints": true,
  "phpAnalyzer.highlightDangerousPatterns": true,
  "phpAnalyzer.showPOPChains": true,
  "phpAnalyzer.autoAnalyzeOnOpen": false,
  "phpAnalyzer.maxChainDepth": 5,
  "phpAnalyzer.showGraphOnAnalysis": true
}
```

## Performance Tips

- Disable `autoAnalyzeOnOpen` for large files
- Reduce `maxChainDepth` if analysis is slow
- Use specific commands instead of Full Analysis for quick checks

## Keyboard Shortcuts (Optional)

You can add custom keybindings in `keybindings.json`:

```json
[
  {
    "key": "ctrl+shift+a",
    "command": "phpAnalyzer.fullSecurityAnalysis",
    "when": "resourceLangId == php"
  },
  {
    "key": "ctrl+shift+v",
    "command": "phpAnalyzer.trackVariableFlow",
    "when": "resourceLangId == php"
  }
]
```

## Next Steps

After testing:
1. Try with your own PHP files
2. Test CTF challenge code
3. Generate exploit payloads
4. Customize vulnerability patterns
5. Provide feedback and report issues

---

**Happy Security Testing! 🔒**
