# Quick Start Guide - Interactive Graph Visualization

## What's New?

The PHP Code Analyzer now includes a **browser-based interactive graph visualization** feature! View your code structure, class hierarchies, data flows, and attack chains in an interactive web interface.

## Getting Started

### 1. Open a PHP File

Open any PHP file in VS Code that you want to analyze.

### 2. Run Analysis Commands

You can run any of these commands:

**Via Right-Click Menu:**
- Right-click in your PHP file
- Select any "PHP Analyzer" command
- Choose from:
  - `Show Code Graph`
  - `Show Inheritance Graph`
  - `Show Data Flow Graph`
  - `Analyze Attack Chains`
  - `Full Security Analysis`

**Via Command Palette (Ctrl/Cmd + Shift + P):**
- Type "PHP Analyzer"
- Select the desired graph command

### 3. View in Browser

- Your default browser will open automatically
- The graph will display at `http://localhost:3000`
- Interact with the visualization!

## Using the Graph Interface

### Navigation Controls

Located on the right side of the graph:

- **+** button: Zoom in
- **−** button: Zoom out
- **□** button: Fit to screen (auto-zoom to show all nodes)
- **⊙** button: Center the graph

### Mouse Controls

- **Click & Drag**: Pan around the graph
- **Mouse Wheel**: Zoom in/out
- **Click Node**: See node details in the sidebar
- **Double-Click Node**: (Future) Jump to code in VS Code

### Search & Filter

1. Use the search box in the sidebar
2. Type to filter nodes by name
3. Matching nodes stay visible, others fade out
4. Clear the search to show all nodes

### Graph Types

Switch between different visualizations using the buttons in the sidebar:

1. **Code Structure**: Shows classes, methods, and their relationships
2. **Inheritance**: Displays class hierarchies (extends/implements)
3. **Data Flow**: Shows data sources (inputs) and sinks (dangerous functions)
4. **Attack Chain**: Visualizes potential attack paths

### Export

- **Export PNG**: Click the "Export PNG" button in the navbar
- Image downloads automatically with high resolution

## Configuration

### Change Server Port

If port 3000 is already in use:

1. Open VS Code Settings (File → Preferences → Settings)
2. Search for "PHP Analyzer"
3. Change "Graph Server Port" to a different value (e.g., 3001)
4. Reload VS Code

**Or edit settings.json:**

```json
{
  "phpAnalyzer.graphServerPort": 3001
}
```

### Auto-Show Graph After Analysis

To automatically open the graph after running Full Security Analysis:

```json
{
  "phpAnalyzer.showGraphOnAnalysis": true
}
```

## Tips & Tricks

### 1. Large Codebases

For files with many classes:
- Use the **Fit to Screen** button to get an overview
- Use **Search** to find specific classes/methods
- Zoom in on specific areas of interest

### 2. Attack Analysis Workflow

1. Run **Full Security Analysis** first
2. Review findings in the "Analysis Results" panel
3. Run **Analyze Attack Chains** to visualize exploit paths
4. Use the graph to understand the attack flow

### 3. Understanding the Colors

**Node Colors:**
- 🔵 Blue: Class
- 🟢 Green: Method
- 🔴 Red: Magic Method or Sink (dangerous)
- 🟠 Orange: Source (user input)

**Edge Colors:**
- Gray: Contains (class has method)
- Blue: Calls
- Red: Extends
- Green: Implements
- Orange: Data flow

### 4. Multi-File Analysis

Currently, the analyzer works on single files. For multi-file projects:
- Analyze each file separately
- Compare graphs to understand relationships
- Look for common patterns across files

## Troubleshooting

### Graph Doesn't Open

**Problem:** Browser doesn't open after running command.

**Solutions:**
1. Check if another application is using port 3000
2. Manually navigate to `http://localhost:3000`
3. Check VS Code Output panel for errors
4. Change the port in settings

### Empty Graph

**Problem:** Graph loads but shows no nodes.

**Solutions:**
1. Make sure you have a PHP file open
2. Verify the PHP file has classes/methods to analyze
3. Check that the analysis completed successfully
4. Try running the command again

### Server Won't Start

**Problem:** Error message about server not starting.

**Solutions:**
1. Check Output panel (View → Output → PHP Code Analyzer)
2. Restart VS Code
3. Verify port is available
4. Check no firewall is blocking localhost

### Graph is Too Slow

**Problem:** Performance issues with large graphs.

**Solutions:**
1. Use search to filter nodes
2. Analyze smaller portions of code
3. Close other browser tabs
4. Use a modern browser (Chrome/Edge recommended)

## Example Workflow

### Analyzing a CTF Challenge

1. **Open the challenge PHP file**
   ```php
   // challenge.php
   ```

2. **Run Full Security Analysis**
   - Click rocket icon 🚀 in editor title
   - Or right-click → PHP Analyzer → Full Security Analysis

3. **Review findings**
   - Check "Analysis Results" panel in sidebar
   - Look for serialization points, magic methods, vulnerabilities

4. **Visualize attack chains**
   - Right-click → PHP Analyzer → Analyze Attack Chains
   - Graph opens showing potential exploit paths

5. **Generate exploit**
   - If attack chain found, run "Generate Exploit Payload"
   - Copy the generated PHP payload

6. **Test in challenge**
   - Use the payload against the target
   - Iterate based on results

## Advanced Features

### API Access

The graph server exposes a REST API at `http://localhost:3000/api/`

**Endpoints:**
- `GET /api/health` - Server health check
- `GET /api/graph/code` - Get code structure graph
- `GET /api/graph/inheritance` - Get inheritance graph
- `GET /api/graph/dataflow` - Get data flow graph
- `GET /api/graph/attackchain` - Get attack chain graph

### Custom Integration

You can integrate with the graph server from other tools:

```javascript
// Fetch graph data
fetch('http://localhost:3000/api/graph/code')
  .then(r => r.json())
  .then(data => console.log(data));
```

## Getting Help

- **Documentation**: See [GRAPH_VISUALIZATION.md](GRAPH_VISUALIZATION.md)
- **Issues**: Report bugs on GitHub
- **Questions**: Check existing issues or create a new one

## What's Next?

Planned features:
- WebSocket support for real-time updates
- Custom node styling
- Graph comparison
- SVG export
- Dark mode theme
- Multi-file analysis

---

**Happy Analyzing! 🔍🛡️**
