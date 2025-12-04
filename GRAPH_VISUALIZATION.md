# Browser-Based Interactive Graph Visualization

## Overview

The PHP Code Analyzer now includes a powerful browser-based interactive graph visualization feature. This allows you to explore code structure, inheritance relationships, data flows, and attack chains in an interactive web interface.

## Architecture

### Components

1. **Express Server** (`src/server/graphServer.ts`)
   - Local HTTP server running on configurable port (default: 3000)
   - Serves static web resources (HTML, CSS, JS)
   - Provides REST API for graph data
   - Automatically starts with extension activation

2. **Web Frontend** (`web/`)
   - Interactive graph visualization using Cytoscape.js
   - Bootstrap 5 UI framework
   - Responsive design
   - Real-time node search and filtering

3. **VS Code Integration** (`src/extension.ts`)
   - Updated command handlers to use browser instead of webview
   - Graph data synchronization with server
   - Automatic browser launch

## Features

### Interactive Graph Controls

- **Zoom**: +/- buttons or mouse wheel
- **Pan**: Click and drag
- **Fit to Screen**: Auto-adjust view
- **Center**: Reset view position
- **Search**: Filter nodes by name
- **Export**: Save graphs as PNG

### Graph Types

#### 1. Code Structure Graph
Shows the overall code architecture:
- Classes (blue nodes)
- Methods (green nodes)
- Magic methods (red nodes)
- Containment relationships

**Command**: `PHP Analyzer: Show Code Graph`

#### 2. Inheritance Graph
Visualizes class hierarchies:
- Class nodes
- Extends relationships (red edges)
- Implements relationships (green edges)

**Command**: `PHP Analyzer: Show Inheritance Graph`

#### 3. Data Flow Graph
Displays data sources and sinks:
- Input sources (orange nodes): $_GET, $_POST, $_COOKIE, $_REQUEST
- Dangerous sinks (red nodes): eval, system, exec, unserialize

**Command**: `PHP Analyzer: Show Data Flow Graph`

#### 4. Attack Chain Graph
Shows potential attack paths:
- Attack steps
- Flow between steps
- Exploitability indicators

**Command**: `PHP Analyzer: Analyze Attack Chains`

## Usage

### Basic Workflow

1. Open a PHP file in VS Code
2. Right-click and select any graph command from the context menu
3. The analysis runs and browser opens automatically
4. Interact with the graph in your default browser

### Configuration

Add to your VS Code `settings.json`:

```json
{
  "phpAnalyzer.graphServerPort": 3000,
  "phpAnalyzer.showGraphOnAnalysis": true
}
```

**Settings**:
- `graphServerPort`: Port for the visualization server (1024-65535)
- `showGraphOnAnalysis`: Auto-show graph after full analysis

### Commands

All commands available via:
- Right-click context menu (when editing PHP files)
- Command Palette (Ctrl/Cmd + Shift + P)

| Command | Description |
|---------|-------------|
| PHP Analyzer: Show Code Graph | Display code structure |
| PHP Analyzer: Show Inheritance Graph | Display class hierarchy |
| PHP Analyzer: Show Data Flow Graph | Display data sources/sinks |
| PHP Analyzer: Analyze Attack Chains | Analyze and show attack paths |
| PHP Analyzer: Full Security Analysis | Complete analysis + graph |

## API Documentation

### REST Endpoints

#### GET /api/health
Health check endpoint.

**Response**:
```json
{
  "status": "ok",
  "timestamp": "2024-01-01T00:00:00.000Z"
}
```

#### GET /api/graph/{type}
Get graph data for specified type.

**Types**: `code`, `inheritance`, `dataflow`, `attackchain`

**Response**:
```json
{
  "nodes": [
    {
      "id": "class_User",
      "label": "User",
      "type": "class",
      "metadata": {}
    }
  ],
  "edges": [
    {
      "source": "class_User",
      "target": "method_User___construct",
      "type": "contains",
      "label": ""
    }
  ]
}
```

#### POST /api/analysis
Submit new analysis data (for future use).

**Request**:
```json
{
  "fileHash": "abc123",
  "data": { ... }
}
```

## Technical Details

### Server Lifecycle

1. **Activation**: Server starts when extension activates
2. **Running**: Listens on configured port
3. **Deactivation**: Server stops when extension deactivates

### Error Handling

- Port conflicts: Warning message shown, webview fallback
- Server not running: Error message with restart suggestion
- Graph data unavailable: User-friendly 404 messages

### Performance

- Efficient graph rendering with Cytoscape.js
- Client-side caching
- Optimized for graphs with 100-500 nodes
- Lazy loading for large datasets

## Development

### Adding New Graph Types

1. Create builder method in `CodeGraphProvider`:
```typescript
public buildMyGraph(ast: any, document: vscode.TextDocument): CodeGraph {
    // Build graph
    return { nodes, edges };
}
```

2. Add server endpoint in `graphServer.ts`:
```typescript
this.app.get('/api/graph/mygraph', (req, res) => {
    if (this.currentGraphData.mygraph) {
        res.json(this.currentGraphData.mygraph);
    } else {
        res.status(404).json({ error: 'No graph data' });
    }
});
```

3. Add command handler in `extension.ts`:
```typescript
async function showMyGraph(provider: CodeGraphProvider) {
    // ... get document and analyze
    const graph = provider.buildMyGraph(ast, document);
    graphServer.updateGraphData('mygraph', graph);
    // ... open browser
}
```

4. Update frontend in `graph.js`:
```javascript
async function loadMyGraph() {
    const graphData = await api.fetchMyGraph();
    renderGraph(graphData);
}
```

### Testing

Run the test script to verify server functionality:

```bash
node test-server.js
```

This tests all API endpoints and basic functionality.

## Troubleshooting

### Port Already in Use

**Error**: "Port 3000 is already in use"

**Solution**: 
1. Change the port in settings
2. Stop other applications using port 3000
3. Restart VS Code

### Browser Doesn't Open

**Error**: Graph doesn't appear in browser

**Solution**:
1. Check if server is running in Output panel
2. Manually navigate to `http://localhost:3000`
3. Check browser console for errors

### Graph Not Loading

**Error**: "No graph data available"

**Solution**:
1. Run analysis command first
2. Check that PHP file is open and valid
3. Verify server is running

### Server Won't Start

**Error**: "Failed to start graph server"

**Solution**:
1. Check port is available
2. Verify Express dependencies are installed
3. Check Output panel for detailed errors
4. Restart VS Code

## Security Considerations

- Server only listens on localhost (127.0.0.1)
- No external network access
- CORS enabled for local development
- No sensitive data exposed in API
- Automatic cleanup on extension deactivate

## Browser Compatibility

Tested and supported:
- Chrome 90+
- Edge 90+
- Firefox 88+
- Safari 14+

## Future Enhancements

Planned features:
- [ ] WebSocket support for real-time updates
- [ ] Graph persistence and history
- [ ] Custom graph layouts
- [ ] Dark mode theme
- [ ] Graph export to SVG
- [ ] Multi-file analysis
- [ ] Node annotations and comments
- [ ] Custom filtering rules

## Contributing

When adding new visualization features:
1. Update server API endpoints
2. Add corresponding frontend handlers
3. Update documentation
4. Add tests
5. Consider performance impact

## License

Same as the main extension (see LICENSE file).
