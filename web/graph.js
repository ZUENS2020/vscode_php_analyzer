// Graph visualization using Cytoscape.js

let cy = null;
let currentGraphType = 'code';

// Node type color mapping
const NODE_COLORS = {
    'class': '#4a9eff',
    'method': '#6cbc6c',
    'magic': '#ff6b6b',
    'source': '#ff9f40',
    'sink': '#dc3545',
    'property': '#9966ff',
    'serialization': '#ffcc00'
};

// Edge type color mapping
const EDGE_COLORS = {
    'contains': '#999999',
    'calls': '#4a9eff',
    'extends': '#ff6b6b',
    'implements': '#6cbc6c',
    'dataflow': '#ff9f40'
};

// Initialize Cytoscape
function initializeCytoscape() {
    cy = cytoscape({
        container: document.getElementById('cy'),
        
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': function(ele) {
                        return NODE_COLORS[ele.data('type')] || '#999999';
                    },
                    'label': 'data(label)',
                    'color': '#333',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '12px',
                    'width': 40,
                    'height': 40,
                    'border-width': 2,
                    'border-color': '#fff',
                    'text-outline-color': '#fff',
                    'text-outline-width': 2
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': 4,
                    'border-color': '#000'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': 2,
                    'line-color': function(ele) {
                        return EDGE_COLORS[ele.data('type')] || '#999999';
                    },
                    'target-arrow-color': function(ele) {
                        return EDGE_COLORS[ele.data('type')] || '#999999';
                    },
                    'target-arrow-shape': 'triangle',
                    'curve-style': 'bezier',
                    'label': 'data(label)',
                    'font-size': '10px',
                    'text-rotation': 'autorotate',
                    'text-background-color': '#fff',
                    'text-background-opacity': 0.8,
                    'text-background-padding': '2px'
                }
            },
            {
                selector: 'edge:selected',
                style: {
                    'width': 4,
                    'line-color': '#000'
                }
            },
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#ff0000',
                    'line-color': '#ff0000',
                    'target-arrow-color': '#ff0000',
                    'border-width': 4,
                    'border-color': '#ff0000'
                }
            },
            {
                selector: '.filtered',
                style: {
                    'opacity': 0.2
                }
            }
        ],
        
        layout: {
            name: 'cose',
            idealEdgeLength: 100,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 30,
            randomize: false,
            componentSpacing: 100,
            nodeRepulsion: 400000,
            edgeElasticity: 100,
            nestingFactor: 5,
            gravity: 80,
            numIter: 1000,
            initialTemp: 200,
            coolingFactor: 0.95,
            minTemp: 1.0
        }
    });

    // Event handlers
    cy.on('tap', 'node', function(evt) {
        const node = evt.target;
        handleNodeClick(node);
    });

    cy.on('tap', function(evt) {
        if (evt.target === cy) {
            clearNodeSelection();
        }
    });

    // Double click to jump to code (future feature with VS Code integration)
    cy.on('dbltap', 'node', function(evt) {
        const node = evt.target;
        showNotification('Double-click feature: Jump to code in VS Code (coming soon)');
    });
}

// Load graph data from API
async function loadGraphType(type) {
    try {
        showLoading();
        currentGraphType = type;
        
        // Update active button
        document.querySelectorAll('[data-graph-type]').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-graph-type="${type}"]`).classList.add('active');
        
        // Fetch data from API
        let graphData = null;
        switch(type) {
            case 'code':
                graphData = await api.fetchCodeGraph();
                break;
            case 'inheritance':
                graphData = await api.fetchInheritanceGraph();
                break;
            case 'dataflow':
                graphData = await api.fetchDataFlowGraph();
                break;
            case 'attackchain':
                graphData = await api.fetchAttackChainGraph();
                break;
        }
        
        if (graphData) {
            renderGraph(graphData);
            showNotification(`Loaded ${type} graph successfully`);
        } else {
            showNotification(`No ${type} graph data available. Run analysis in VS Code first.`, 'warning');
            clearGraph();
        }
        
    } catch (error) {
        console.error('Error loading graph:', error);
        showNotification(`Error loading ${type} graph: ${error.message}`, 'error');
    } finally {
        hideLoading();
    }
}

// Render graph data
function renderGraph(graphData) {
    if (!cy) {
        initializeCytoscape();
    }
    
    cy.elements().remove();
    
    // Add nodes
    const nodes = graphData.nodes.map(node => ({
        group: 'nodes',
        data: {
            id: node.id,
            label: node.label,
            type: node.type,
            metadata: node.metadata
        }
    }));
    
    // Add edges
    const edges = graphData.edges.map(edge => ({
        group: 'edges',
        data: {
            id: `${edge.source}-${edge.target}`,
            source: edge.source,
            target: edge.target,
            type: edge.type,
            label: edge.label || '',
            metadata: edge.metadata
        }
    }));
    
    cy.add([...nodes, ...edges]);
    
    // Apply layout
    cy.layout({
        name: 'cose',
        idealEdgeLength: 100,
        nodeOverlap: 20,
        refresh: 20,
        fit: true,
        padding: 30,
        randomize: false,
        componentSpacing: 100,
        nodeRepulsion: 400000,
        edgeElasticity: 100,
        nestingFactor: 5,
        gravity: 80,
        numIter: 1000,
        initialTemp: 200,
        coolingFactor: 0.95,
        minTemp: 1.0
    }).run();
    
    // Update statistics
    updateStatsDisplay();
}

// Clear graph
function clearGraph() {
    if (cy) {
        cy.elements().remove();
    }
}

// Handle node click
function handleNodeClick(node) {
    const data = node.data();
    
    // Update node details panel - safely escape HTML
    const detailsDiv = document.getElementById('nodeDetails');
    
    // Clear previous content
    detailsDiv.innerHTML = '';
    
    // Create elements safely
    const h6 = document.createElement('h6');
    h6.textContent = data.label;
    detailsDiv.appendChild(h6);
    
    const typeBadge = document.createElement('p');
    const badge = document.createElement('span');
    badge.className = 'badge bg-primary';
    badge.textContent = data.type;
    typeBadge.appendChild(badge);
    detailsDiv.appendChild(typeBadge);
    
    const idPara = document.createElement('p');
    const idStrong = document.createElement('strong');
    idStrong.textContent = 'ID: ';
    idPara.appendChild(idStrong);
    idPara.appendChild(document.createTextNode(data.id));
    detailsDiv.appendChild(idPara);
    
    // Add metadata if present
    if (data.metadata) {
        const metaPara = document.createElement('p');
        const metaStrong = document.createElement('strong');
        metaStrong.textContent = 'Additional Info: ';
        metaPara.appendChild(metaStrong);
        
        const metaPre = document.createElement('pre');
        metaPre.style.fontSize = '12px';
        metaPre.textContent = JSON.stringify(data.metadata, null, 2);
        metaPara.appendChild(metaPre);
        detailsDiv.appendChild(metaPara);
    }
}

// Clear node selection
function clearNodeSelection() {
    const detailsDiv = document.getElementById('nodeDetails');
    detailsDiv.textContent = '';
    
    const p = document.createElement('p');
    p.className = 'text-muted';
    p.textContent = 'Click a node to see details';
    detailsDiv.appendChild(p);
}

// Filter nodes based on search
function filterNodes() {
    if (!cy) { return; }
    
    const searchTerm = document.getElementById('searchInput').value.toLowerCase();
    
    if (!searchTerm) {
        cy.elements().removeClass('filtered');
        return;
    }
    
    cy.nodes().forEach(node => {
        const label = node.data('label').toLowerCase();
        if (label.includes(searchTerm)) {
            node.removeClass('filtered');
        } else {
            node.addClass('filtered');
        }
    });
}

// Graph controls
function zoomIn() {
    if (cy) {
        cy.zoom(cy.zoom() * 1.2);
        cy.center();
    }
}

function zoomOut() {
    if (cy) {
        cy.zoom(cy.zoom() / 1.2);
        cy.center();
    }
}

function fitGraph() {
    if (cy) {
        cy.fit();
    }
}

function centerGraph() {
    if (cy) {
        cy.center();
    }
}

// Export graph as image
function exportGraph(format) {
    if (!cy) {
        showNotification('No graph to export', 'warning');
        return;
    }
    
    try {
        let dataUrl;
        if (format === 'png') {
            dataUrl = cy.png({ full: true, scale: 2 });
        } else if (format === 'svg') {
            // SVG export requires additional plugin
            showNotification('SVG export requires additional setup', 'warning');
            return;
        }
        
        // Download the image
        const link = document.createElement('a');
        link.href = dataUrl;
        link.download = `graph-${currentGraphType}-${Date.now()}.${format}`;
        link.click();
        
        showNotification(`Graph exported as ${format.toUpperCase()}`, 'success');
    } catch (error) {
        console.error('Export error:', error);
        showNotification(`Error exporting graph: ${error.message}`, 'error');
    }
}

// Loading overlay
function showLoading() {
    const container = document.getElementById('graph-container');
    if (!document.querySelector('.loading-overlay')) {
        const overlay = document.createElement('div');
        overlay.className = 'loading-overlay';
        overlay.innerHTML = '<div class="spinner-border loading-spinner text-primary" role="status"><span class="visually-hidden">Loading...</span></div>';
        container.appendChild(overlay);
    }
}

function hideLoading() {
    const overlay = document.querySelector('.loading-overlay');
    if (overlay) {
        overlay.remove();
    }
}

// Notification system
function showNotification(message, type = 'info') {
    const toastEl = document.getElementById('notificationToast');
    const messageEl = document.getElementById('toastMessage');
    
    messageEl.textContent = message;
    
    // Update toast styling based on type
    toastEl.className = 'toast';
    if (type === 'error') {
        toastEl.classList.add('bg-danger', 'text-white');
    } else if (type === 'warning') {
        toastEl.classList.add('bg-warning');
    } else if (type === 'success') {
        toastEl.classList.add('bg-success', 'text-white');
    }
    
    const toast = new bootstrap.Toast(toastEl);
    toast.show();
}

// ============================================================================
// Enhanced Data Flow Visualization Features
// ============================================================================

// Highlight taint paths - show all paths from sources to sinks
function highlightTaintPaths() {
    if (!cy) { return; }
    
    // Reset all highlighting
    cy.elements().removeClass('highlighted');
    
    // Find all source nodes
    const sources = cy.nodes().filter(node => node.data('type') === 'source');
    
    // Find all sink nodes
    const sinks = cy.nodes().filter(node => node.data('type') === 'sink');
    
    if (sources.length === 0 || sinks.length === 0) {
        showNotification('No sources or sinks found in the graph', 'info');
        return;
    }
    
    let pathCount = 0;
    
    // For each source, find paths to sinks
    sources.forEach(source => {
        sinks.forEach(sink => {
            const paths = cy.elements().dijkstra({
                root: source,
                directed: true
            }).pathTo(sink);
            
            if (paths && paths.length > 0) {
                paths.addClass('highlighted');
                pathCount++;
            }
        });
    });
    
    if (pathCount > 0) {
        showNotification(`Highlighted ${pathCount} taint path(s)`, 'success');
    } else {
        showNotification('No paths found from sources to sinks', 'warning');
    }
}

// Clear all highlighting
function clearHighlighting() {
    if (!cy) { return; }
    cy.elements().removeClass('highlighted');
    showNotification('Cleared highlighting', 'info');
}

// Filter by node type
function filterByType(type) {
    if (!cy) { return; }
    
    if (type === 'all') {
        cy.elements().removeClass('filtered');
        showNotification('Showing all nodes', 'info');
        return;
    }
    
    cy.nodes().forEach(node => {
        if (node.data('type') === type) {
            node.removeClass('filtered');
        } else {
            node.addClass('filtered');
        }
    });
    
    showNotification(`Filtered to show only ${type} nodes`, 'info');
}

// Show only critical paths (severity: critical or high)
function showCriticalPaths() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    let criticalCount = 0;
    
    // Find edges with critical/high severity
    cy.edges().forEach(edge => {
        const metadata = edge.data('metadata');
        if (metadata && (metadata.severity === 'critical' || metadata.severity === 'high')) {
            edge.removeClass('filtered');
            edge.source().removeClass('filtered');
            edge.target().removeClass('filtered');
            criticalCount++;
        }
    });
    
    if (criticalCount > 0) {
        showNotification(`Showing ${criticalCount} critical path(s)`, 'success');
    } else {
        showNotification('No critical paths found', 'warning');
        cy.elements().removeClass('filtered');
    }
}

// Highlight vulnerability types
function highlightVulnerabilityType(vulnType) {
    if (!cy) { return; }
    
    cy.elements().removeClass('highlighted');
    
    let count = 0;
    
    cy.edges().forEach(edge => {
        const metadata = edge.data('metadata');
        if (metadata && metadata.vulnerabilityType && 
            metadata.vulnerabilityType.toLowerCase().includes(vulnType.toLowerCase())) {
            edge.addClass('highlighted');
            edge.source().addClass('highlighted');
            edge.target().addClass('highlighted');
            count++;
        }
    });
    
    if (count > 0) {
        showNotification(`Highlighted ${count} ${vulnType} vulnerability path(s)`, 'success');
    } else {
        showNotification(`No ${vulnType} vulnerabilities found`, 'warning');
    }
}

// Show node neighbors (connected nodes)
function showNeighbors(node) {
    if (!cy || !node) { return; }
    
    cy.elements().addClass('filtered');
    node.removeClass('filtered');
    
    // Show connected nodes
    const neighbors = node.neighborhood();
    neighbors.removeClass('filtered');
    
    showNotification(`Showing neighbors of ${node.data('label')}`, 'info');
}

// Find shortest path between two nodes
function findShortestPath(sourceId, targetId) {
    if (!cy) { return; }
    
    const source = cy.getElementById(sourceId);
    const target = cy.getElementById(targetId);
    
    if (!source.length || !target.length) {
        showNotification('Source or target node not found', 'error');
        return;
    }
    
    cy.elements().removeClass('highlighted');
    
    const dijkstra = cy.elements().dijkstra({
        root: source,
        directed: true
    });
    
    const path = dijkstra.pathTo(target);
    
    if (path && path.length > 0) {
        path.addClass('highlighted');
        showNotification(`Found path from ${source.data('label')} to ${target.data('label')}`, 'success');
    } else {
        showNotification('No path found between selected nodes', 'warning');
    }
}

// Get statistics about the current graph
function getGraphStats() {
    if (!cy) { 
        return { nodes: 0, edges: 0, sources: 0, sinks: 0, paths: 0 };
    }
    
    const stats = {
        nodes: cy.nodes().length,
        edges: cy.edges().length,
        sources: cy.nodes().filter(n => n.data('type') === 'source').length,
        sinks: cy.nodes().filter(n => n.data('type') === 'sink').length,
        taintedNodes: cy.nodes().filter(n => n.data('metadata')?.isTainted === true).length,
        vulnerabilities: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        }
    };
    
    // Count vulnerabilities by severity
    cy.edges().forEach(edge => {
        const metadata = edge.data('metadata');
        if (metadata && metadata.severity) {
            stats.vulnerabilities[metadata.severity] = (stats.vulnerabilities[metadata.severity] || 0) + 1;
        }
    });
    
    return stats;
}

// Update statistics display
function updateStatsDisplay() {
    const stats = getGraphStats();
    const statsDiv = document.getElementById('graphStats');
    
    if (!statsDiv) { return; }
    
    statsDiv.innerHTML = '';
    
    const title = document.createElement('h6');
    title.textContent = 'Graph Statistics';
    statsDiv.appendChild(title);
    
    const list = document.createElement('ul');
    list.className = 'list-unstyled';
    
    const items = [
        `Nodes: ${stats.nodes}`,
        `Edges: ${stats.edges}`,
        `Sources: ${stats.sources}`,
        `Sinks: ${stats.sinks}`,
        `Tainted: ${stats.taintedNodes}`,
        `Critical: ${stats.vulnerabilities.critical}`,
        `High: ${stats.vulnerabilities.high}`,
        `Medium: ${stats.vulnerabilities.medium}`,
        `Low: ${stats.vulnerabilities.low}`
    ];
    
    items.forEach(item => {
        const li = document.createElement('li');
        li.textContent = item;
        list.appendChild(li);
    });
    
    statsDiv.appendChild(list);
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', async function() {
    initializeCytoscape();
    
    // Check server health
    try {
        await api.healthCheck();
        console.log('Server connection successful');
    } catch (error) {
        showNotification('Failed to connect to server', 'error');
    }
    
    // Load default graph (code structure)
    loadGraphType('code');
});
