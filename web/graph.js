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
            label: edge.label || ''
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
    
    // Update node details panel
    const detailsDiv = document.getElementById('nodeDetails');
    detailsDiv.innerHTML = `
        <h6>${data.label}</h6>
        <p><span class="badge bg-primary">${data.type}</span></p>
        <p><strong>ID:</strong> ${data.id}</p>
        ${data.metadata ? `<p><strong>Additional Info:</strong> ${JSON.stringify(data.metadata, null, 2)}</p>` : ''}
    `;
}

// Clear node selection
function clearNodeSelection() {
    const detailsDiv = document.getElementById('nodeDetails');
    detailsDiv.innerHTML = '<p class="text-muted">Click a node to see details</p>';
}

// Filter nodes based on search
function filterNodes() {
    if (!cy) {return;}
    
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
