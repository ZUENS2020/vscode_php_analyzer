# PHP Code Analyzer for CTF

Advanced PHP security analyzer for CTF challenges - detect POP chains, vulnerabilities, and attack vectors.

## Features

### 🔍 Variable Tracking
- Track variable flow throughout the file
- Identify definitions, assignments, and references
- Trace user input to dangerous functions

**Command:** `PHP Analyzer: Track Variable Flow`

### 🏗️ Class Analysis
- Analyze class structure and relationships
- Identify inheritance and interfaces
- List properties, methods, and magic methods
- Mark dangerous operations

**Command:** `PHP Analyzer: Analyze Class Relations`

### 🪄 Magic Method Detection
- Find all magic methods in PHP classes
- Identify dangerous operations within magic methods
- Detect potential gadget classes for POP chains

**Magic Methods Detected:**
- `__construct`, `__destruct`
- `__wakeup`, `__sleep`
- `__toString`, `__invoke`
- `__call`, `__callStatic`
- `__get`, `__set`
- And more...

**Command:** `PHP Analyzer: Show Magic Methods`

### 📦 Serialization Analysis
- Locate all `serialize()` and `unserialize()` calls
- Analyze parameter sources (user input detection)
- Check for `allowed_classes` usage
- Highlight dangerous deserialization points

**Command:** `PHP Analyzer: Find Serialization Points`

### ⛓️ POP Chain Detection
- Automatically detect Property-Oriented Programming chains
- Trace from magic methods to dangerous functions
- Calculate exploitability scores
- Generate attack path descriptions

**Command:** `PHP Analyzer: Find POP Chain`

### 🎯 Attack Chain Analysis
- Identify complete attack vectors
- Detect Phar deserialization opportunities
- Find user input to dangerous function paths
- Assess risk levels (Critical/High/Medium/Low)

**Command:** `PHP Analyzer: Analyze Attack Chains`

### 🛡️ Vulnerability Scanner
- Scan for 20+ vulnerability patterns
- Categories:
  - **DESER**: Unsafe deserialization
  - **TYPE**: Type confusion
  - **PHAR**: Phar deserialization
  - **MAGIC**: Magic method abuse
  - **FUNC**: Dangerous functions
  - **AUTO**: Autoload exploitation

**Command:** `PHP Analyzer: Scan Vulnerabilities`

### 💣 Exploit Payload Generation
- Generate PHP exploit code
- Create serialized payloads
- Build Phar files
- Customizable for different attack chains

**Command:** `PHP Analyzer: Generate Exploit Payload`

### 📊 Full Security Analysis
- One-click comprehensive analysis
- Progress tracking with status updates
- Combines all analysis features
- Automatic code graph generation

**Command:** `PHP Analyzer: Full Security Analysis`

### 🗺️ Interactive Graph Visualization
- **Browser-based** interactive graph visualization
- **Code Structure Graph**: Classes, methods, and relationships
- **Inheritance Graph**: Class hierarchy visualization
- **Data Flow Graph**: Track data from sources to sinks
- **Attack Chain Graph**: Visualize attack paths and exploits
- Interactive zoom, pan, search, and filter
- Export graphs as PNG images
- Real-time updates from VS Code

**Features:**
- Powered by Cytoscape.js for high-performance rendering
- Bootstrap 5 responsive UI
- Runs on local Express server (localhost only)
- Automatic browser launch
- Search and filter nodes
- Click to see node details

**Commands:**
- `PHP Analyzer: Show Code Graph`
- `PHP Analyzer: Show Inheritance Graph`
- `PHP Analyzer: Show Data Flow Graph`
- `PHP Analyzer: Analyze Attack Chains` (includes graph)

**Configuration:**
```json
{
  "phpAnalyzer.graphServerPort": 3000,
  "phpAnalyzer.showGraphOnAnalysis": true
}
```

See [GRAPH_VISUALIZATION.md](GRAPH_VISUALIZATION.md) for detailed documentation.

## Installation

1. Clone this repository
2. Run `npm install`
3. Run `npm run compile`
4. Press F5 to open in Extension Development Host

Or package and install:
```bash
npm install -g @vscode/vsce
vsce package
code --install-extension php-code-analyzer-ctf-0.2.0.vsix
```

## Usage

### Quick Start

1. Open a PHP file in VS Code
2. Click the rocket icon 🚀 in the editor title bar, or
3. Right-click and select "Full Security Analysis"
4. View results in the "PHP Security Analyzer" sidebar

### Context Menu

Right-click in a PHP file to access:
- Track Variable Flow (select a variable first)
- Analyze Class Relations (select a class name first)
- Full Security Analysis
- Analyze Attack Chains
- Show Code Graph

### Command Palette

Press `Ctrl+Shift+P` (Windows/Linux) or `Cmd+Shift+P` (Mac) and type "PHP Analyzer" to see all commands.

## Configuration

Access settings via `File > Preferences > Settings` and search for "PHP Analyzer":

- **phpAnalyzer.enableInlineHints** (default: `true`)
  - Show inline hints for variable types and dangerous patterns

- **phpAnalyzer.highlightDangerousPatterns** (default: `true`)
  - Highlight dangerous code patterns with colored backgrounds

- **phpAnalyzer.showPOPChains** (default: `true`)
  - Automatically detect and display POP chains

- **phpAnalyzer.autoAnalyzeOnOpen** (default: `false`)
  - Automatically run vulnerability scan when opening PHP files
  - Warning: May impact performance on large files

- **phpAnalyzer.maxChainDepth** (default: `5`, range: `1-10`)
  - Maximum depth for POP chain and attack chain detection
  - Higher values find more chains but take longer

- **phpAnalyzer.showGraphOnAnalysis** (default: `true`)
  - Automatically show code graph after running Full Analysis

## CTF Usage Examples

### Example 1: Finding POP Chains

```php
<?php
class Logger {
    private $logfile;
    
    public function __destruct() {
        file_put_contents($this->logfile, "Log entry");
    }
}

class User {
    public $name;
    
    public function __toString() {
        return $this->name;
    }
}
```

The analyzer will detect:
1. `__destruct` with `file_put_contents()` (dangerous operation)
2. `__toString` that could trigger string context
3. Potential POP chain if these classes are combined

### Example 2: Unsafe Deserialization

```php
<?php
$data = $_GET['data'];
$obj = unserialize(base64_decode($data));
```

The analyzer will flag:
- Critical vulnerability: User input to `unserialize()`
- Missing `allowed_classes` restriction
- Potential for object injection

### Example 3: Phar Deserialization

```php
<?php
$file = $_GET['file'];
if (file_exists($file)) {
    echo "File exists!";
}
```

The analyzer will detect:
- User-controlled file path
- `file_exists()` can trigger phar:// deserialization
- High-risk attack chain

## Vulnerability Patterns

The extension detects these vulnerability patterns:

| ID | Name | Severity | Description |
|----|------|----------|-------------|
| DESER-001 | Unsafe Deserialization | Critical | User input to `unserialize()` |
| DESER-002 | Missing allowed_classes | High | No class whitelist |
| FUNC-001 | eval() Usage | Critical | Use of `eval()` |
| FUNC-003 | Command Execution | Critical | System commands |
| FUNC-004 | Dangerous Callback | High | User-controlled callbacks |
| MAGIC-002 | Dangerous __destruct | High | Dangerous ops in destructor |
| PHAR-001 | Phar Deserialization | High | File functions with user input |

## Development

### Project Structure

```
vscode_php_highlighter/
├── src/
│   ├── analyzers/
│   │   ├── phpAnalyzer.ts          # Core AST parser
│   │   ├── variableTracker.ts      # Variable flow analysis
│   │   ├── classAnalyzer.ts        # Class structure analysis
│   │   ├── magicMethodDetector.ts  # Magic method detection
│   │   ├── serializationAnalyzer.ts # Serialization points
│   │   ├── popChainDetector.ts     # POP chain detection
│   │   ├── attackChainAnalyzer.ts  # Attack chain analysis
│   │   └── vulnerabilityScanner.ts # Vulnerability patterns
│   ├── providers/
│   │   ├── analysisResultsProvider.ts # Tree view provider
│   │   └── codeGraphProvider.ts    # Graph visualization
│   ├── utils/
│   │   └── payloadGenerator.ts     # Exploit generation
│   ├── types/
│   │   └── index.ts                # TypeScript interfaces
│   └── extension.ts                # Extension entry point
├── package.json
├── tsconfig.json
└── README.md
```

### Building

```bash
npm run compile      # Compile TypeScript
npm run watch        # Watch mode for development
npm run lint         # Run ESLint
```

### Testing

The extension uses the `php-parser` library to parse PHP code into an AST (Abstract Syntax Tree), which is then analyzed for security issues.

## Requirements

- VS Code 1.80.0 or higher
- PHP files to analyze

## Known Issues

- AST parser may not handle all PHP syntax variations
- Complex inheritance chains may not be fully detected
- False positives possible in vulnerability detection

## Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

MIT License - See LICENSE file for details

## Credits

Created for CTF security analysis and educational purposes.

**Dangerous Functions Detected:**
- Code execution: `eval`, `assert`, `create_function`
- Command execution: `system`, `exec`, `passthru`, `shell_exec`
- Deserialization: `unserialize`, `unserialize`
- Callbacks: `call_user_func`, `call_user_func_array`
- File operations: `file_get_contents`, `file_put_contents`
- Includes: `include`, `require`, `include_once`, `require_once`

## Support

For issues and feature requests, please use the GitHub issue tracker.

## Version History

### 0.2.0 (Current)
- Full feature implementation
- 12 analysis commands
- Interactive code graphs
- Exploit payload generation
- 20+ vulnerability patterns
- Comprehensive documentation

---

**Note:** This tool is for educational and authorized security testing only. Always obtain proper authorization before testing systems you don't own.
