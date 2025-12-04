# Development Guide

This guide is for developers who want to contribute to or modify the PHP Code Analyzer extension.

## Prerequisites

- Node.js 18.x or higher
- npm 9.x or higher
- VS Code 1.75.0 or higher
- Basic knowledge of TypeScript and VS Code Extension API

## Project Structure

```
vscode_php_highlighter/
├── src/                          # Source code
│   ├── analyzers/               # Core analysis logic
│   │   ├── phpAnalyzer.ts      # Base PHP parser wrapper
│   │   ├── variableTracker.ts  # Variable flow tracking
│   │   ├── classAnalyzer.ts    # Class analysis
│   │   ├── serializationAnalyzer.ts  # Serialization detection
│   │   └── popChainDetector.ts # POP chain detection
│   ├── providers/              # VS Code providers
│   │   ├── analysisTreeProvider.ts   # Sidebar tree view
│   │   ├── decorationProvider.ts     # Code decorations
│   │   └── inlineHintsProvider.ts    # Inline hints
│   ├── models/                 # TypeScript interfaces
│   │   └── analysisModels.ts   # Data models
│   └── extension.ts            # Extension entry point
├── examples/                    # Example PHP files
├── resources/                   # Icons and resources
├── .vscode/                    # VS Code config for development
├── package.json                # Extension manifest
├── tsconfig.json              # TypeScript configuration
└── .eslintrc.json            # ESLint configuration
```

## Setup Development Environment

1. Clone the repository:
```bash
git clone https://github.com/ZUENS2020/vscode_php_highlighter.git
cd vscode_php_highlighter
```

2. Install dependencies:
```bash
npm install
```

3. Build the project:
```bash
npm run compile
```

4. Open in VS Code:
```bash
code .
```

## Development Workflow

### 1. Running the Extension

Press `F5` in VS Code to launch a new Extension Development Host window with the extension loaded.

Alternatively:
1. Open Command Palette (`Ctrl+Shift+P`)
2. Run "Debug: Start Debugging"

### 2. Making Changes

1. Edit source files in `src/`
2. Save changes
3. Reload the Extension Development Host:
   - Press `Ctrl+R` in the Extension Development Host window
   - Or press `Ctrl+Shift+F5` in the development VS Code window

### 3. Watch Mode

For automatic compilation on file changes:
```bash
npm run watch
```

This will watch for changes and recompile automatically.

## Testing

### Manual Testing

1. Open the Extension Development Host (F5)
2. Open the example file: `examples/test_ctf_challenge.php`
3. Test each feature:
   - Right-click on a variable → "Track Variable Flow"
   - Right-click on a class → "Analyze Class Relations"
   - Run commands from Command Palette

### Testing with Custom PHP Files

Create your own PHP files in the Extension Development Host and test various scenarios:

```php
// Test variable tracking
$test = "value";
echo $test;

// Test class analysis
class TestClass {
    public function __destruct() {
        echo "test";
    }
}

// Test serialization detection
unserialize($_GET['data']);
```

## Code Style

### TypeScript Guidelines

- Use 4 spaces for indentation
- Use TypeScript types where possible
- Follow naming conventions:
  - Classes: PascalCase
  - Functions/methods: camelCase
  - Constants: UPPER_SNAKE_CASE
  - Interfaces: PascalCase with 'I' prefix (optional)

### Linting

Run the linter:
```bash
npm run lint
```

The project uses ESLint with TypeScript support. Warnings about `any` types are acceptable but should be minimized.

## Architecture

### 1. Extension Activation

`extension.ts` is the entry point:
- Registers commands
- Initializes analyzers
- Sets up providers
- Listens to document changes

### 2. PHP Parsing

`phpAnalyzer.ts` wraps the `php-parser` library:
- Parses PHP code into AST
- Provides utility methods for AST traversal
- Handles parsing errors gracefully

### 3. Analysis Pipeline

```
PHP Code → Parser → AST → Analyzers → Results → Providers → UI
```

### 4. Providers

- **AnalysisTreeProvider**: Displays results in sidebar
- **DecorationProvider**: Highlights code
- **InlineHintsProvider**: Shows inline hints

## Adding New Features

### Example: Add a New Command

1. Register the command in `package.json`:
```json
{
  "contributes": {
    "commands": [
      {
        "command": "phpAnalyzer.myNewCommand",
        "title": "My New Command",
        "category": "PHP Analyzer"
      }
    ]
  }
}
```

2. Implement the command in `extension.ts`:
```typescript
context.subscriptions.push(
    vscode.commands.registerCommand('phpAnalyzer.myNewCommand', async () => {
        // Implementation
    })
);
```

3. Create an analyzer if needed in `src/analyzers/`:
```typescript
export class MyAnalyzer {
    constructor(private analyzer: PhpAnalyzer) {}
    
    async analyze(code: string): Promise<MyResult> {
        const ast = this.analyzer.parseCode(code);
        // Analysis logic
        return result;
    }
}
```

### Example: Add a New Pattern Detection

1. Add the pattern to `serializationAnalyzer.ts` or create a new analyzer
2. Update the analysis models in `models/analysisModels.ts`
3. Update the tree provider to display results
4. Add decorations if needed

## Debugging

### Debug Configuration

The project includes debug configurations in `.vscode/launch.json`:

- **Run Extension**: Launch extension in debug mode
- **Extension Tests**: Run tests (when implemented)

### Debug Tips

1. Use `console.log()` for simple debugging (output appears in Debug Console)
2. Set breakpoints in TypeScript files
3. Use the Debug Console to inspect variables
4. Check the Extension Host log for errors

### Common Issues

**Issue**: Extension not activating
- Check the activation events in `package.json`
- Verify the extension is compiled (`npm run compile`)
- Check for syntax errors in TypeScript

**Issue**: Parser errors
- The parser may fail on some PHP syntax
- Check if the PHP code is valid
- The parser uses `suppressErrors: true` to be lenient

**Issue**: AST traversal issues
- Use `console.log(JSON.stringify(ast, null, 2))` to inspect the AST
- Different PHP constructs have different AST structures
- Check the php-parser documentation

## Building for Distribution

### Package the Extension

```bash
npm install -g vsce
vsce package
```

This creates a `.vsix` file that can be installed in VS Code.

### Install Locally

```bash
code --install-extension php-code-analyzer-0.1.0.vsix
```

## Performance Optimization

### Current Optimizations

1. **Lazy Loading**: Analyzers are created once and reused
2. **Suppressed Errors**: Parser doesn't fail on syntax errors
3. **Selective Analysis**: Only analyze when needed
4. **Background Analysis**: Some analysis runs in background

### Future Optimizations

- Cache AST results for unchanged documents
- Implement incremental parsing
- Use Web Workers for heavy analysis
- Add debouncing for real-time analysis

## Dependencies

### Core Dependencies

- `php-parser`: PHP code parsing into AST
- `vis-network`: Graph visualization (planned)

### Dev Dependencies

- `typescript`: TypeScript compiler
- `eslint`: Code linting
- `@types/vscode`: VS Code API types
- `@types/node`: Node.js types

## Contributing Guidelines

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/my-feature`
3. Make changes and test thoroughly
4. Run linter: `npm run lint`
5. Commit changes: `git commit -m "Add my feature"`
6. Push to branch: `git push origin feature/my-feature`
7. Create a Pull Request

## Resources

- [VS Code Extension API](https://code.visualstudio.com/api)
- [php-parser Documentation](https://github.com/glayzzle/php-parser)
- [TypeScript Handbook](https://www.typescriptlang.org/docs/)
- [ESLint Rules](https://eslint.org/docs/rules/)

## License

MIT License - See LICENSE file for details.

## Support

For issues and feature requests, please use GitHub Issues.
