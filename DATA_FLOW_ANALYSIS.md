# Enhanced Data Flow Analysis - Implementation Documentation

## Overview

This document describes the comprehensive data flow analysis implementation for the PHP Code Analyzer extension. The enhancement provides deep analysis of code execution paths, taint propagation, object relationships, call graphs, and conditional branches.

## Architecture

### Core Analyzers

#### 1. DataFlowAnalyzer (`src/analyzers/dataFlowAnalyzer.ts`)

Tracks data flow from sources to sinks with comprehensive taint propagation analysis.

**Key Features:**
- **Source Detection**: Identifies taint sources including:
  - Superglobals: `$_GET`, `$_POST`, `$_COOKIE`, `$_REQUEST`, `$_FILES`, `$_SERVER`, `$_ENV`
  - File operations: `file_get_contents`, `fread`, etc.
  - Network operations: `curl_exec`
  - Database queries: `mysql_query`, `mysqli_query`, `pg_query`

- **Sink Detection**: Identifies dangerous sinks:
  - Code execution: `eval`, `assert`, `create_function`
  - Command execution: `system`, `exec`, `passthru`, `shell_exec`
  - SQL injection: `mysql_query`, `mysqli_query`, `pg_query`
  - File operations: `file_put_contents`, `include`, `require`
  - Deserialization: `unserialize`, `yaml_parse`
  - Callbacks: `call_user_func`, `array_map`, etc.

- **Taint Propagation**: Tracks taint through:
  - Variable assignments
  - Function calls
  - Property access
  - String concatenation
  - Array operations

**Output:**
```typescript
interface DataFlowAnalysis {
    sources: DataSource[];          // All identified sources
    sinks: DataSink[];              // All identified sinks
    paths: DataFlowPath[];          // Complete paths from sources to sinks
    entities: Entity[];             // All tracked entities
    relationships: Relationship[];  // Entity relationships
}
```

#### 2. ObjectRelationAnalyzer (`src/analyzers/objectRelationAnalyzer.ts`)

Analyzes object-oriented code patterns and relationships.

**Key Features:**
- Object creation tracking (`new ClassName()`)
- Property access analysis (read/write operations)
- Method call tracking
- Method chain detection (`$obj->method1()->method2()`)
- Static method call detection

**Output:**
```typescript
interface ObjectRelation {
    objectName: string;
    className: string;
    properties: PropertyAccess[];
    methods: MethodCall[];
    methodChains: MethodChain[];
}
```

#### 3. CallGraphAnalyzer (`src/analyzers/callGraphAnalyzer.ts`)

Builds a complete call graph of the application.

**Key Features:**
- Function and method call tracking
- Recursion detection (direct and indirect)
- Callback function tracking
- Argument and return value analysis

**Output:**
```typescript
interface CallRelation {
    caller: string;
    callee: string;
    arguments: Entity[];
    returnValue?: Entity;
    isRecursive: boolean;
    isTainted: boolean;
}
```

#### 4. ConditionalPathAnalyzer (`src/analyzers/conditionalPathAnalyzer.ts`)

Analyzes conditional execution paths.

**Key Features:**
- If/else branch analysis
- Switch statement analysis
- Ternary operator tracking
- Logical operator short-circuit evaluation (`&&`, `||`)
- Branch-specific taint tracking

**Output:**
```typescript
interface Condition {
    type: 'if' | 'switch' | 'ternary' | 'logical';
    expression: string;
    branches: ConditionalBranch[];
}
```

## Integration

### Code Graph Provider

The `buildDataFlowGraph()` method in `codeGraphProvider.ts` now:
1. Runs all four analyzers
2. Combines results into a unified graph
3. Creates nodes for sources, sinks, entities, objects, and functions
4. Creates edges for data flow, relationships, and calls
5. Annotates edges with metadata (severity, vulnerability type, taint status)

### Graph Server API

New endpoint: `POST /api/analysis/dataflow`

**Request:**
```json
{
    "filePath": "path/to/file.php",
    "analysis": "comprehensive"
}
```

**Response:**
```json
{
    "success": true,
    "filePath": "path/to/file.php",
    "analysis": "comprehensive",
    "data": {
        "nodes": [...],
        "edges": [...]
    }
}
```

### Web Visualization

Enhanced `web/graph.js` provides:

**New Functions:**
- `highlightTaintPaths()` - Highlights all paths from sources to sinks
- `clearHighlighting()` - Removes all highlighting
- `filterByType(type)` - Filters nodes by type (source, sink, class, method, etc.)
- `showCriticalPaths()` - Shows only critical/high severity paths
- `highlightVulnerabilityType(type)` - Highlights specific vulnerability types
- `getGraphStats()` - Returns detailed statistics
- `updateStatsDisplay()` - Updates the statistics panel

**UI Controls (web/index.html):**
- Data Flow Analysis section with buttons for:
  - Highlight Taint Paths
  - Show Critical Only
  - Clear Highlighting
- Filter by Type dropdown
- Statistics panel showing:
  - Node/edge counts
  - Source/sink counts
  - Tainted node count
  - Vulnerability severity breakdown

## Usage

### In VS Code

1. Open a PHP file
2. Run command: "PHP Analyzer: Show Data Flow Graph"
3. The graph visualization opens in browser
4. Use controls to:
   - Filter by node type
   - Highlight taint paths
   - View critical paths only
   - Search for specific nodes

### Programmatic Usage

```typescript
import { DataFlowAnalyzer } from './analyzers/dataFlowAnalyzer';
import { PHPAnalyzer } from './analyzers/phpAnalyzer';

// Parse PHP code
const phpAnalyzer = new PHPAnalyzer(phpCode);
const ast = phpAnalyzer.getAST();

// Run data flow analysis
const dataFlowAnalyzer = new DataFlowAnalyzer(ast, document);
const analysis = dataFlowAnalyzer.analyze();

// Access results
console.log(`Found ${analysis.sources.length} sources`);
console.log(`Found ${analysis.sinks.length} sinks`);
console.log(`Found ${analysis.paths.length} vulnerable paths`);
```

## Example Output

For the `ctf_example.php` file:

```
Sources detected:
  1. $_POST[...] (superglobal) at line 44
  2. $_POST (superglobal) at line 44

Sinks detected:
  1. call_user_func (callback, severity: high) at line 169

Objects analyzed: 2
  1. $this (Unknown)
     Properties: 10
     Methods: 0
  2. $validator (Unknown)
     Properties: 1
     Methods: 1

Call relations: 2
Conditional constructs: 15
  - if: 14
  - logical: 1
```

## Vulnerability Detection

The analyzer assigns severity levels to data flow paths:

- **CRITICAL**: eval, exec, deserialization
- **HIGH**: SQL injection, callback functions
- **MEDIUM**: File operations
- **LOW**: Other

Each path includes:
- Source → Sink mapping
- Intermediate transformation nodes
- Vulnerability type classification
- Severity assessment
- Conditional dependencies

## Performance Considerations

- Analysis is performed once when graph is requested
- Results are cached in graph server
- Large files (>1000 lines) may take several seconds
- AST traversal is optimized to avoid redundant visits
- Taint tracking uses efficient Map-based storage

## Future Enhancements

Potential improvements:
1. Inter-procedural analysis across files
2. More sophisticated taint sanitization detection
3. Custom source/sink configuration
4. Path ranking by exploitability
5. Automatic payload generation for discovered paths
6. Integration with external vulnerability databases

## Testing

Run the test suite:
```bash
npm run compile
node test_dataflow.js
```

Expected output:
- All analyzers complete successfully
- Sources, sinks, and paths detected
- Objects and call relations identified
- Conditional constructs analyzed

## API Reference

### DataFlowAnalyzer

```typescript
class DataFlowAnalyzer {
    constructor(ast: any, document: vscode.TextDocument)
    analyze(): DataFlowAnalysis
}
```

### ObjectRelationAnalyzer

```typescript
class ObjectRelationAnalyzer {
    constructor(ast: any, document: vscode.TextDocument)
    analyze(): ObjectRelation[]
}
```

### CallGraphAnalyzer

```typescript
class CallGraphAnalyzer {
    constructor(ast: any, document: vscode.TextDocument)
    analyze(): CallRelation[]
}
```

### ConditionalPathAnalyzer

```typescript
class ConditionalPathAnalyzer {
    constructor(ast: any, document: vscode.TextDocument)
    analyze(): Condition[]
}
```

## Troubleshooting

**Issue**: No data flow graph displayed
- **Solution**: Ensure graph server is running on port 3000

**Issue**: Empty results
- **Solution**: Check if PHP code has recognized sources/sinks

**Issue**: Missing paths
- **Solution**: Verify taint propagation through variable assignments

**Issue**: Compilation errors
- **Solution**: Run `npm install` and `npm run compile`

## Contributing

When adding new sources or sinks:
1. Update the respective arrays in `dataFlowAnalyzer.ts`
2. Add corresponding severity levels
3. Update documentation
4. Add test cases
5. Verify with `test_dataflow.js`

## License

Same as main project license.
