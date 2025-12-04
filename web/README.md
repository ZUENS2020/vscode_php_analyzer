# Interactive Graph Visualization

This directory contains the browser-based interactive graph visualization for the PHP Code Analyzer.

## Overview

The visualization server provides an interactive web interface using Cytoscape.js for displaying:
- Code structure graphs
- Class inheritance graphs
- Data flow graphs
- Attack chain graphs

## Features

### Interactive Controls
- **Zoom**: Use the +/- buttons or mouse wheel
- **Pan**: Click and drag the graph
- **Fit to Screen**: Automatically adjust view to show all nodes
- **Center**: Center the graph in the viewport

### Graph Types
1. **Code Structure**: Shows classes, methods, and their relationships
2. **Inheritance**: Displays class hierarchy and interface implementations
3. **Data Flow**: Visualizes data sources and sinks
4. **Attack Chain**: Shows potential attack paths and exploits

### Search & Filter
- Search for nodes by name using the search box
- Click nodes to see detailed information
- Double-click nodes to jump to code (when integrated with VS Code)

### Export
- Export graphs as PNG images
- SVG export (requires additional setup)

## Technical Stack

- **Frontend**: HTML5, CSS3, JavaScript (ES6+)
- **Graph Library**: Cytoscape.js 3.26.0
- **UI Framework**: Bootstrap 5.3.0
- **Server**: Express.js (Node.js)

## Files

- `index.html` - Main page with UI layout
- `styles.css` - Custom styles and responsive design
- `graph.js` - Graph rendering and interaction logic
- `api.js` - API client for server communication

## API Endpoints

The server exposes the following REST API endpoints:

- `GET /api/health` - Health check
- `GET /api/graph/code` - Get code structure graph data
- `GET /api/graph/inheritance` - Get inheritance graph data
- `GET /api/graph/dataflow` - Get data flow graph data
- `GET /api/graph/attackchain` - Get attack chain graph data
- `POST /api/analysis` - Submit new analysis data
- `GET /api/analysis/:fileHash` - Get analysis results by hash

## Usage

The graph visualization is automatically launched when you:
1. Run "Show Code Graph" command
2. Run "Show Inheritance Graph" command
3. Run "Show Data Flow Graph" command
4. Run "Analyze Attack Chains" command
5. Run "Full Security Analysis" (if auto-show is enabled)

The server starts automatically when the extension activates and stops when it deactivates.

## Configuration

You can configure the server port in VS Code settings:
```json
{
  "phpAnalyzer.graphServerPort": 3000
}
```

Default port is 3000. Change it if there's a conflict with other services.

## Browser Compatibility

Tested with:
- Chrome/Edge (Chromium) 90+
- Firefox 88+
- Safari 14+

## Performance

The graph visualization is optimized for:
- Up to 100 nodes: Excellent performance
- 100-500 nodes: Good performance
- 500+ nodes: May experience lag, use filtering

## Future Enhancements

- [ ] WebSocket support for real-time updates
- [ ] SVG export functionality
- [ ] Graph layout customization
- [ ] Theme support (dark/light mode)
- [ ] Multi-file analysis support
- [ ] Graph comparison feature
- [ ] Custom node styling
- [ ] Graph animation controls
