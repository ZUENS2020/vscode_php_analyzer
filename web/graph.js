// Graph visualization using Cytoscape.js

let cy = null;
let currentGraphType = 'code';
let currentFilePath = '';  // Store current PHP file path

// Node type color mapping - darker colors for better contrast
const NODE_COLORS = {
    'class': '#2196F3',
    'method': '#4CAF50',
    'magic': '#f44336',
    'source': '#FF9800',
    'sink': '#E91E63',
    'property': '#9C27B0',
    'serialization': '#FFC107',
    'entry': '#00E676',
    'chain': '#FF5722'
};

// Node shape mapping
const NODE_SHAPES = {
    'class': 'rectangle',
    'method': 'ellipse',
    'magic': 'diamond',
    'source': 'hexagon',
    'sink': 'octagon',
    'property': 'triangle',
    'serialization': 'round-rectangle',
    'entry': 'star',
    'chain': 'diamond'
};

// Edge type color mapping - brighter for dark background
const EDGE_COLORS = {
    'contains': '#607D8B',
    'calls': '#2196F3',
    'extends': '#f44336',
    'implements': '#4CAF50',
    'dataflow': '#FF9800',
    'triggers': '#ff1744',
    'invokes': '#E91E63',
    'property_flow': '#9C27B0'
};

// Edge style mapping
const EDGE_STYLES = {
    'contains': 'dashed',
    'calls': 'solid',
    'extends': 'solid',
    'implements': 'dashed',
    'dataflow': 'solid',
    'triggers': 'solid',
    'invokes': 'solid',
    'property_flow': 'dashed'
};

// Edge width mapping
const EDGE_WIDTHS = {
    'contains': 1,
    'calls': 2,
    'extends': 3,
    'implements': 2,
    'dataflow': 3,
    'triggers': 4,
    'invokes': 3,
    'property_flow': 2
};

// Initialize Cytoscape
function initializeCytoscape() {
    // Helper function to get node size based on type
    function getNodeSize(type) {
        const sizes = {
            'entry': 70,
            'class': 65,
            'magic': 55,
            'sink': 60,
            'source': 55,
            'property': 35,
            'chain': 55
        };
        return sizes[type] || 40;
    }

    cy = cytoscape({
        container: document.getElementById('cy'),
        
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': function(ele) {
                        return NODE_COLORS[ele.data('type')] || '#607D8B';
                    },
                    'shape': function(ele) {
                        return NODE_SHAPES[ele.data('type')] || 'ellipse';
                    },
                    'label': 'data(label)',
                    'color': '#ffffff',
                    'text-valign': 'center',
                    'text-halign': 'center',
                    'font-size': '11px',
                    'font-weight': 'bold',
                    'width': function(ele) {
                        return getNodeSize(ele.data('type'));
                    },
                    'height': function(ele) {
                        return getNodeSize(ele.data('type'));
                    },
                    'border-width': 3,
                    'border-color': '#ffffff',
                    'text-outline-color': '#000000',
                    'text-outline-width': 2
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': 5,
                    'border-color': '#ffeb3b',
                    'background-color': '#ff5722'
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': function(ele) {
                        return EDGE_WIDTHS[ele.data('type')] || 2;
                    },
                    'line-color': function(ele) {
                        return EDGE_COLORS[ele.data('type')] || '#607D8B';
                    },
                    'line-style': function(ele) {
                        return EDGE_STYLES[ele.data('type')] || 'solid';
                    },
                    'target-arrow-color': function(ele) {
                        return EDGE_COLORS[ele.data('type')] || '#607D8B';
                    },
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 1.5,
                    'curve-style': 'bezier',
                    'label': 'data(label)',
                    'font-size': '10px',
                    'color': '#ffffff',
                    'text-rotation': 'autorotate',
                    'text-background-color': '#1a1a2e',
                    'text-background-opacity': 0.9,
                    'text-background-padding': '3px',
                    'text-outline-color': '#000000',
                    'text-outline-width': 1
                }
            },
            {
                selector: 'edge:selected',
                style: {
                    'width': 5,
                    'line-color': '#ffeb3b',
                    'target-arrow-color': '#ffeb3b'
                }
            },
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#ff1744',
                    'line-color': '#ff1744',
                    'target-arrow-color': '#ff1744',
                    'border-width': 5,
                    'border-color': '#ffeb3b'
                }
            },
            {
                selector: '.filtered',
                style: {
                    'opacity': 0.15
                }
            },
            {
                selector: '.attack-path',
                style: {
                    'line-color': '#ff1744',
                    'target-arrow-color': '#ff1744',
                    'width': 5,
                    'z-index': 999
                }
            }
        ],
        
        layout: {
            name: 'cose',
            idealEdgeLength: 120,
            nodeOverlap: 20,
            refresh: 20,
            fit: true,
            padding: 40,
            randomize: false,
            componentSpacing: 120,
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

    // Double click to jump to code in VS Code
    cy.on('dbltap', 'node', function(evt) {
        const node = evt.target;
        const metadata = node.data('metadata');
        
        if (metadata && metadata.line) {
            highlightInVSCode(metadata.line, metadata.column || 0);
        } else {
            showNotification('No line information available for this node', 'warning');
        }
    });
}

// Fetch current file path from server
async function fetchCurrentFilePath() {
    try {
        const response = await fetch('/api/current-file');
        const data = await response.json();
        if (data.filePath) {
            currentFilePath = data.filePath;
        }
    } catch (error) {
        console.error('Could not fetch current file path:', error);
    }
}

// Send highlight request to VS Code
async function highlightInVSCode(line, column = 0) {
    try {
        // Ensure we have the current file path
        if (!currentFilePath) {
            await fetchCurrentFilePath();
        }
        
        const response = await fetch('/api/highlight', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                line: line,
                column: column || 0,
                filePath: currentFilePath
            })
        });
        
        const result = await response.json();
        
        if (result.success) {
            showNotification(`🎯 Highlighted line ${line} in VS Code`, 'success');
        } else {
            showNotification('Failed to highlight: ' + (result.error || 'Unknown error'), 'error');
        }
    } catch (error) {
        console.error('Highlight error:', error);
        showNotification('Could not communicate with VS Code', 'error');
    }
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
        const activeBtn = document.querySelector(`[data-graph-type="${type}"]`);
        if (activeBtn) {
            activeBtn.classList.add('active');
        }
        
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
            case 'popchain':
                await loadPOPChains();
                return;
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

// Load and display POP chains
async function loadPOPChains() {
    try {
        const response = await fetch('/api/graph/popchains');
        if (!response.ok) {
            showNotification('No POP chain data. Run "Find POP Chain" in VS Code first.', 'warning');
            hideLoading();
            return;
        }
        
        const data = await response.json();
        
        if (data.chains && data.chains.length > 0) {
            // Render the graph
            renderGraph({ nodes: data.nodes, edges: data.edges });
            
            // Show chain details in sidebar
            showPOPChainDetails(data.chains);
            
            showNotification(`Found ${data.chains.length} POP chain(s)`, 'success');
        } else {
            showNotification('No exploitable POP chains found', 'warning');
        }
        
    } catch (error) {
        console.error('Error loading POP chains:', error);
        showNotification('Error loading POP chain data', 'error');
    } finally {
        hideLoading();
    }
}

// Display POP chain details in the sidebar
function showPOPChainDetails(chains) {
    const detailsDiv = document.getElementById('nodeDetails');
    detailsDiv.innerHTML = '';
    
    const title = document.createElement('h5');
    title.textContent = '⛓️ POP Chains';
    title.className = 'text-danger mb-3';
    detailsDiv.appendChild(title);
    
    for (let i = 0; i < chains.length; i++) {
        const chain = chains[i];
        
        const chainDiv = document.createElement('div');
        chainDiv.className = 'card mb-3 bg-dark border-danger';
        
        // Header with risk level
        const header = document.createElement('div');
        header.className = 'card-header d-flex justify-content-between align-items-center';
        const riskBadge = chain.riskLevel === 'critical' ? 'bg-danger' : 
                          chain.riskLevel === 'high' ? 'bg-warning' : 'bg-info';
        header.innerHTML = `
            <strong class="text-warning">⛓️ Chain ${i + 1}</strong>
            <span class="badge ${riskBadge}">${chain.riskLevel?.toUpperCase() || 'HIGH'}</span>
        `;
        chainDiv.appendChild(header);
        
        const body = document.createElement('div');
        body.className = 'card-body p-2';
        
        // Entry point
        const entry = document.createElement('div');
        entry.className = 'mb-2 p-2 rounded';
        entry.style.backgroundColor = '#0f3d0f';
        entry.style.cursor = 'pointer';
        entry.innerHTML = `
            <span class="text-success fw-bold">🎯 入口点</span><br>
            <code class="text-info">${chain.entryClass}::${chain.entryMethod}</code><br>
            <small class="text-muted">点击高亮代码</small>
        `;
        entry.onclick = function() {
            if (chain.steps && chain.steps[0]) {
                highlightInVSCode(chain.steps[0].line);
            }
        };
        body.appendChild(entry);
        
        // Steps with detailed read/write info
        if (chain.steps && chain.steps.length > 0) {
            for (let j = 0; j < chain.steps.length; j++) {
                const step = chain.steps[j];
                
                // Arrow
                const arrow = document.createElement('div');
                arrow.className = 'text-center text-warning my-1';
                arrow.innerHTML = `⬇️ <small class="text-info">${step.trigger || ''}</small>`;
                body.appendChild(arrow);
                
                const stepDiv = document.createElement('div');
                stepDiv.className = 'mb-2 p-2 rounded';
                stepDiv.style.backgroundColor = j === chain.steps.length - 1 ? '#3d0f0f' : '#1a1a2e';
                stepDiv.style.cursor = 'pointer';
                stepDiv.style.border = '1px solid #3a3a5c';
                
                let stepHtml = `
                    <div class="d-flex justify-content-between">
                        <span class="text-warning fw-bold">📍 ${step.className}::${step.methodName}</span>
                        <small class="text-muted">Line ${step.line}</small>
                    </div>
                `;
                
                // 读取的属性
                if (step.reads && step.reads.length > 0) {
                    stepHtml += `<div class="mt-1"><span class="text-success">📖 读取:</span> <code class="text-info">${step.reads.join(', ')}</code></div>`;
                }
                
                // 写入的属性
                if (step.writes && step.writes.length > 0) {
                    stepHtml += `<div class="mt-1"><span class="text-warning">✏️ 写入:</span> <code class="text-info">${step.writes.join(', ')}</code></div>`;
                }
                
                // 调用
                if (step.calls && step.calls.length > 0) {
                    stepHtml += `<div class="mt-1"><span class="text-danger">🔥 调用:</span> <code class="text-danger">${step.calls.join(', ')}</code></div>`;
                }
                
                // 操作描述
                if (step.operations && step.operations.length > 0) {
                    stepHtml += `<div class="mt-1 small text-muted">⚡ ${step.operations.join('; ')}</div>`;
                }
                
                stepDiv.innerHTML = stepHtml;
                stepDiv.onclick = function() {
                    highlightInVSCode(step.line);
                };
                body.appendChild(stepDiv);
            }
        }
        
        // Final sink
        if (chain.finalSink) {
            const arrow = document.createElement('div');
            arrow.className = 'text-center text-danger my-1';
            arrow.innerHTML = '⬇️ <small>执行</small>';
            body.appendChild(arrow);
            
            const sink = document.createElement('div');
            sink.className = 'p-2 rounded text-center';
            sink.style.backgroundColor = '#4d0f0f';
            sink.style.border = '2px solid #ff4444';
            sink.innerHTML = `
                <span class="text-danger fw-bold">💀 危险操作: ${chain.finalSink}</span><br>
                <small class="text-warning">${chain.exploitMethod || '可实现任意代码执行'}</small>
            `;
            body.appendChild(sink);
        }
        
        // Data flow description
        if (chain.dataFlow) {
            const dataFlowDiv = document.createElement('div');
            dataFlowDiv.className = 'mt-2 p-2 rounded';
            dataFlowDiv.style.backgroundColor = '#0f0f23';
            dataFlowDiv.style.border = '1px solid #3a3a5c';
            dataFlowDiv.innerHTML = `
                <div class="text-info small fw-bold mb-1">📊 数据流分析:</div>
                <pre class="text-light small mb-0" style="white-space: pre-wrap;">${chain.dataFlow}</pre>
            `;
            body.appendChild(dataFlowDiv);
        }
        
        // Buttons
        const btnGroup = document.createElement('div');
        btnGroup.className = 'd-flex gap-2 mt-3';
        
        const payloadBtn = document.createElement('button');
        payloadBtn.className = 'btn btn-warning btn-sm flex-grow-1';
        payloadBtn.innerHTML = '📋 查看Payload';
        payloadBtn.onclick = function() {
            showPayloadModal(chain.payload, `${chain.entryClass}::${chain.entryMethod}`);
        };
        btnGroup.appendChild(payloadBtn);
        
        const highlightChainBtn = document.createElement('button');
        highlightChainBtn.className = 'btn btn-outline-info btn-sm';
        highlightChainBtn.innerHTML = '🔍 高亮全部';
        highlightChainBtn.onclick = function() {
            highlightEntireChainNew(chain);
        };
        btnGroup.appendChild(highlightChainBtn);
        
        body.appendChild(btnGroup);
        
        chainDiv.appendChild(body);
        detailsDiv.appendChild(chainDiv);
    }
}

// Highlight entire chain with new structure
async function highlightEntireChainNew(chain) {
    if (chain.steps && chain.steps.length > 0) {
        for (const step of chain.steps) {
            if (step.line) {
                await highlightInVSCode(step.line);
                await new Promise(resolve => setTimeout(resolve, 1200));
            }
        }
        showNotification('链高亮完成!', 'success');
    }
}

// Get human-readable exploit info from action
function getExploitInfo(action) {
    if (!action) return 'Chain link';
    if (action.includes('invoke')) return 'Object called as function → __invoke()';
    if (action.includes('set')) return 'Property assignment → __set()';
    if (action.includes('call')) return 'Dynamic method call → __call()';
    if (action.includes('toString')) return 'String context → __toString()';
    if (action.includes('destruct')) return 'Object destroyed → __destruct()';
    if (action.includes('wakeup')) return 'Unserialized → __wakeup()';
    if (action.includes('dynamic')) return '⚠️ Dynamic execution!';
    return action.substring(0, 40);
}

// Get exploitation method for sink type
function getSinkExploitMethod(sinkType) {
    const methods = {
        'dynamic_rce': '($var)() or $obj->$method() → RCE',
        'dynamic_invoke': 'Object as callable → Execute arbitrary code',
        'dynamic_method': '$obj->$var() → Call any method',
        'dynamic_call': 'Variable function call',
        'rce': 'system/exec/eval → Remote Code Execution',
        'file': 'File read/write vulnerability',
        'sql': 'SQL Injection possible',
        'ssrf': 'Server-Side Request Forgery'
    };
    return methods[sinkType] || 'Dangerous operation';
}

// Highlight entire chain in sequence
async function highlightEntireChain(chain) {
    // First highlight entry
    await highlightInVSCode(chain.entryPoint.line);
    
    // Then highlight each step with delay
    for (const step of chain.steps) {
        if (step.line) {
            await new Promise(resolve => setTimeout(resolve, 1500));
            await highlightInVSCode(step.line);
        }
    }
    
    showNotification('Chain highlight complete!', 'success');
}

// Show payload in a modal
function showPayloadModal(payload, chainName) {
    // Create modal if it doesn't exist
    let modal = document.getElementById('payloadModal');
    if (!modal) {
        modal = document.createElement('div');
        modal.id = 'payloadModal';
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content bg-dark text-light">
                    <div class="modal-header border-secondary">
                        <h5 class="modal-title text-danger">💀 Exploit Payload</h5>
                        <button type="button" class="btn-close btn-close-white" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <pre id="payloadCode" style="max-height: 400px; overflow: auto; background: #0f0f23; color: #4fc3f7; padding: 15px; border-radius: 5px; border: 1px solid #3a3a5c;"></pre>
                    </div>
                    <div class="modal-footer border-secondary">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                        <button type="button" class="btn btn-warning" onclick="copyPayload()">📋 Copy to Clipboard</button>
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(modal);
    }
    
    // Set payload content
    document.getElementById('payloadCode').textContent = payload;
    
    // Show modal
    const bsModal = new bootstrap.Modal(modal);
    bsModal.show();
}

// Copy payload to clipboard
function copyPayload() {
    const payload = document.getElementById('payloadCode').textContent;
    navigator.clipboard.writeText(payload).then(() => {
        showNotification('Payload copied to clipboard!', 'success');
    }).catch(err => {
        showNotification('Failed to copy payload', 'error');
    });
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
    
    // Add line number and highlight button if available
    if (data.metadata && data.metadata.line) {
        const linePara = document.createElement('p');
        const lineStrong = document.createElement('strong');
        lineStrong.textContent = 'Line: ';
        linePara.appendChild(lineStrong);
        linePara.appendChild(document.createTextNode(data.metadata.line));
        detailsDiv.appendChild(linePara);
        
        // Add highlight button
        const highlightBtn = document.createElement('button');
        highlightBtn.className = 'btn btn-warning btn-sm mt-2';
        highlightBtn.innerHTML = '🎯 Highlight in VS Code';
        highlightBtn.onclick = function() {
            highlightInVSCode(data.metadata.line, data.metadata.column || 0);
        };
        detailsDiv.appendChild(highlightBtn);
    }
    
    // Add metadata if present
    if (data.metadata) {
        const metaPara = document.createElement('p');
        metaPara.className = 'mt-2';
        const metaStrong = document.createElement('strong');
        metaStrong.textContent = 'Additional Info: ';
        metaPara.appendChild(metaStrong);
        
        const metaPre = document.createElement('pre');
        metaPre.style.fontSize = '12px';
        metaPre.style.maxHeight = '200px';
        metaPre.style.overflow = 'auto';
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

// ============================================================================
// Enhanced Filter and Highlight Functions
// ============================================================================

/**
 * Show all nodes and edges
 */
function showAll() {
    if (!cy) { return; }
    cy.elements().removeClass('filtered highlighted');
    showNotification('Showing all elements', 'info');
}

/**
 * Show only inheritance relationships
 */
function showInheritance() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show class nodes
    cy.nodes().filter(n => n.data('type') === 'class').removeClass('filtered');
    
    // Show extends and implements edges
    const inheritanceEdges = cy.edges().filter(e => 
        e.data('type') === 'extends' || e.data('type') === 'implements'
    );
    
    inheritanceEdges.removeClass('filtered');
    inheritanceEdges.connectedNodes().removeClass('filtered');
    
    showNotification(`Showing ${inheritanceEdges.length} inheritance relationship(s)`, 'info');
}

/**
 * Show only magic method chains
 */
function showMagicChain() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show entry points
    cy.nodes().filter(n => n.data('type') === 'entry').removeClass('filtered');
    
    // Show magic methods
    cy.nodes().filter(n => n.data('type') === 'magic').removeClass('filtered');
    
    // Show trigger edges
    const triggerEdges = cy.edges().filter(e => e.data('type') === 'triggers');
    triggerEdges.removeClass('filtered');
    triggerEdges.connectedNodes().removeClass('filtered');
    
    showNotification('Showing magic method trigger chains', 'info');
}

/**
 * Show only data flow
 */
function showDataFlow() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show sources, sinks, and properties
    cy.nodes().filter(n => 
        n.data('type') === 'source' || 
        n.data('type') === 'sink' || 
        n.data('type') === 'property'
    ).removeClass('filtered');
    
    // Show dataflow edges
    const dataflowEdges = cy.edges().filter(e => e.data('type') === 'dataflow');
    dataflowEdges.removeClass('filtered');
    dataflowEdges.connectedNodes().removeClass('filtered');
    
    showNotification('Showing data flow paths', 'info');
}

/**
 * Highlight complete POP chains from entry to sink
 */
function highlightPOPChain() {
    if (!cy) { return; }
    
    cy.elements().removeClass('highlighted');
    
    // Find all entry points
    const entries = cy.nodes().filter(n => n.data('type') === 'entry');
    
    // Find all sinks
    const sinks = cy.nodes().filter(n => n.data('type') === 'sink');
    
    if (entries.length === 0) {
        showNotification('No entry points found', 'warning');
        return;
    }
    
    if (sinks.length === 0) {
        showNotification('No sinks found', 'warning');
        return;
    }
    
    let pathCount = 0;
    
    // For each entry, find paths to sinks
    entries.forEach(entry => {
        sinks.forEach(sink => {
            const dijkstra = cy.elements().dijkstra({
                root: entry,
                directed: true
            });
            
            const path = dijkstra.pathTo(sink);
            
            if (path && path.length > 0) {
                path.addClass('highlighted');
                pathCount++;
            }
        });
    });
    
    if (pathCount > 0) {
        showNotification(`Highlighted ${pathCount} complete POP chain(s)`, 'success');
    } else {
        showNotification('No complete paths from entry to sink found', 'warning');
    }
}

/**
 * Filter to show only specific edge type
 */
function filterEdgeType(edgeType) {
    if (!cy) { return; }
    
    if (edgeType === 'all') {
        cy.elements().removeClass('filtered');
        showNotification('Showing all edges', 'info');
        return;
    }
    
    cy.elements().addClass('filtered');
    
    const edges = cy.edges().filter(e => e.data('type') === edgeType);
    edges.removeClass('filtered');
    edges.connectedNodes().removeClass('filtered');
    
    showNotification(`Filtered to show ${edges.length} ${edgeType} edge(s)`, 'info');
}

// Initialize on page load
document.addEventListener('DOMContentLoaded', function() {
    // Fetch current file path
    fetchCurrentFilePath();
    
    // Try to load code graph by default
    loadGraphType('code');
});
