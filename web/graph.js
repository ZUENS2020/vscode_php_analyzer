// Graph visualization using Cytoscape.js - Maltego-inspired clean UI

let cy = null;
let currentGraphType = 'code';
let currentFilePath = '';  // Store current PHP file path

// Maltego-style node colors - high contrast, professional
const NODE_COLORS = {
    'class': '#3498db',      // Blue
    'method': '#27ae60',     // Green
    'magic': '#e74c3c',      // Red
    'source': '#f39c12',     // Orange
    'sink': '#c0392b',       // Dark red
    'property': '#9b59b6',   // Purple
    'serialization': '#f1c40f', // Yellow
    'entry': '#1abc9c',      // Teal
    'chain': '#e67e22',      // Dark orange
    'function': '#16a085',   // Dark teal
    'interface': '#2980b9',  // Dark blue
    'variable': '#8e44ad'    // Dark purple
};

// Maltego-style shapes - simple geometric
const NODE_SHAPES = {
    'class': 'round-rectangle',
    'method': 'ellipse',
    'magic': 'diamond',
    'source': 'hexagon',
    'sink': 'octagon',
    'property': 'round-rectangle',
    'serialization': 'round-rectangle',
    'entry': 'star',
    'chain': 'diamond',
    'function': 'ellipse',
    'interface': 'round-rectangle',
    'variable': 'ellipse'
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
    'property_flow': '#9C27B0',
    'has_property': '#9C27B0',
    'has_method': '#4CAF50',
    'uses_property': '#795548',
    'calls_dangerous': '#f44336',
    'assigns': '#8BC34A',
    'uses': '#00BCD4',
    'returns': '#FF5722',
    'references': '#03A9F4'
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
    'property_flow': 'dashed',
    'has_property': 'dashed',
    'has_method': 'dashed',
    'uses_property': 'dotted',
    'calls_dangerous': 'solid',
    'assigns': 'solid',
    'uses': 'dotted',
    'returns': 'solid',
    'references': 'dashed'
};

// Edge width mapping - thinner, cleaner lines
const EDGE_WIDTHS = {
    'contains': 1,
    'calls': 1.5,
    'extends': 2,
    'implements': 1.5,
    'dataflow': 2,
    'triggers': 2.5,
    'invokes': 2,
    'property_flow': 1.5,
    'has_property': 1,
    'has_method': 1,
    'uses_property': 1,
    'calls_dangerous': 2,
    'assigns': 1.5,
    'uses': 1,
    'returns': 1.5,
    'references': 1
};

// Initialize Cytoscape with Maltego-inspired styling
function initializeCytoscape() {
    // Maltego-style node sizing - compact but readable
    function getNodeSize(type) {
        const sizes = {
            'entry': 50,
            'class': 45,
            'magic': 40,
            'sink': 45,
            'source': 40,
            'property': 30,
            'chain': 40,
            'method': 35,
            'function': 35,
            'interface': 40,
            'variable': 30
        };
        return sizes[type] || 35;
    }

    cy = cytoscape({
        container: document.getElementById('cy'),
        
        // Enable high quality rendering
        textureOnViewport: false,
        hideEdgesOnViewport: false,
        hideLabelsOnViewport: false,
        
        // Maltego-inspired clean style
        style: [
            {
                selector: 'node',
                style: {
                    'background-color': function(ele) {
                        return NODE_COLORS[ele.data('type')] || '#7f8c8d';
                    },
                    'background-opacity': 0.95,
                    'shape': function(ele) {
                        return NODE_SHAPES[ele.data('type')] || 'ellipse';
                    },
                    'label': function(ele) {
                        // Truncate long labels for cleaner display
                        const label = ele.data('label') || '';
                        return label.length > 20 ? label.substring(0, 18) + '...' : label;
                    },
                    'color': '#ffffff',
                    'text-valign': 'bottom',
                    'text-halign': 'center',
                    'text-margin-y': 5,
                    'font-size': '12px',
                    'font-family': 'Consolas, Monaco, monospace',
                    'font-weight': '600',
                    'width': function(ele) {
                        return getNodeSize(ele.data('type'));
                    },
                    'height': function(ele) {
                        return getNodeSize(ele.data('type'));
                    },
                    'border-width': 2,
                    'border-color': '#ffffff',
                    'border-opacity': 0.8,
                    'text-outline-color': '#1a1a2e',
                    'text-outline-width': 2,
                    'text-outline-opacity': 1,
                    'min-zoomed-font-size': 10
                }
            },
            {
                selector: 'node:selected',
                style: {
                    'border-width': 4,
                    'border-color': '#f1c40f',
                    'border-opacity': 1,
                    'background-opacity': 1,
                    'overlay-color': '#f1c40f',
                    'overlay-padding': 6,
                    'overlay-opacity': 0.3
                }
            },
            {
                selector: 'node:active',
                style: {
                    'overlay-color': '#3498db',
                    'overlay-padding': 8,
                    'overlay-opacity': 0.25
                }
            },
            {
                selector: 'edge',
                style: {
                    'width': function(ele) {
                        return EDGE_WIDTHS[ele.data('type')] || 1.5;
                    },
                    'line-color': function(ele) {
                        return EDGE_COLORS[ele.data('type')] || '#95a5a6';
                    },
                    'line-style': function(ele) {
                        return EDGE_STYLES[ele.data('type')] || 'solid';
                    },
                    'target-arrow-color': function(ele) {
                        return EDGE_COLORS[ele.data('type')] || '#95a5a6';
                    },
                    'target-arrow-shape': 'triangle',
                    'arrow-scale': 1.2,
                    'curve-style': 'bezier',
                    'opacity': 0.85,
                    // Hide edge labels by default for cleaner look
                    'label': '',
                    'font-size': '9px',
                    'color': '#bdc3c7',
                    'text-rotation': 'autorotate',
                    'text-background-color': '#1a1a2e',
                    'text-background-opacity': 0.9,
                    'text-background-padding': '2px'
                }
            },
            {
                selector: 'edge:selected',
                style: {
                    'width': 3,
                    'line-color': '#f1c40f',
                    'target-arrow-color': '#f1c40f',
                    'opacity': 1,
                    'label': 'data(label)',
                    'z-index': 999
                }
            },
            {
                selector: '.highlighted',
                style: {
                    'background-color': '#e74c3c',
                    'line-color': '#e74c3c',
                    'target-arrow-color': '#e74c3c',
                    'border-width': 4,
                    'border-color': '#f1c40f',
                    'opacity': 1,
                    'z-index': 999
                }
            },
            {
                selector: '.filtered',
                style: {
                    'opacity': 0.1
                }
            },
            {
                selector: '.attack-path',
                style: {
                    'line-color': '#e74c3c',
                    'target-arrow-color': '#e74c3c',
                    'width': 3,
                    'opacity': 1,
                    'z-index': 999
                }
            },
            {
                selector: '.dimmed',
                style: {
                    'opacity': 0.2
                }
            },
            {
                selector: '.focused',
                style: {
                    'opacity': 1,
                    'z-index': 999
                }
            }
        ],
        
        // Better layout for readability
        layout: {
            name: 'cose',
            idealEdgeLength: 100,
            nodeOverlap: 30,
            refresh: 20,
            fit: true,
            padding: 50,
            randomize: false,
            componentSpacing: 150,
            nodeRepulsion: 500000,
            edgeElasticity: 100,
            nestingFactor: 5,
            gravity: 50,
            numIter: 1500,
            initialTemp: 250,
            coolingFactor: 0.95,
            minTemp: 1.0
        },
        
        // Better interaction
        minZoom: 0.2,
        maxZoom: 3,
        wheelSensitivity: 0.3
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
        
        // === 新增: 参数来源信息 ===
        if (chain.paramName || chain.paramSource) {
            const paramDiv = document.createElement('div');
            paramDiv.className = 'mt-2 p-2 rounded';
            paramDiv.style.backgroundColor = '#0f2340';
            paramDiv.style.border = '1px solid #2196F3';
            
            let paramHtml = '<div class="text-info small fw-bold mb-1">📥 参数信息:</div>';
            if (chain.paramSource) {
                paramHtml += `<div><span class="text-muted">来源:</span> <code class="text-warning">${chain.paramSource}</code></div>`;
            }
            if (chain.paramName) {
                paramHtml += `<div><span class="text-muted">参数名:</span> <code class="text-info">${chain.paramName}</code></div>`;
            }
            // 构造完整利用 URL 提示
            if (chain.paramSource && chain.paramName) {
                paramHtml += `<div class="mt-1 small text-success">💡 利用: <code>?${chain.paramName}=PAYLOAD</code></div>`;
            }
            
            paramDiv.innerHTML = paramHtml;
            body.appendChild(paramDiv);
        }
        
        // === 新增: __wakeup 绕过提示 ===
        if (chain.bypassWakeup) {
            const bypassDiv = document.createElement('div');
            bypassDiv.className = 'mt-2 p-2 rounded';
            bypassDiv.style.backgroundColor = '#402020';
            bypassDiv.style.border = '1px solid #ff6b6b';
            
            bypassDiv.innerHTML = `
                <div class="text-warning small fw-bold mb-1">⚠️ 需要绕过 __wakeup:</div>
                <div class="small text-light">CVE-2016-7124 (PHP < 7.4.26)</div>
                <div class="small text-muted">修改序列化字符串中的属性数量</div>
                <code class="small text-info">O:N:"Class":X:{...}</code> → <code class="small text-success">O:N:"Class":X+1:{...}</code>
            `;
            body.appendChild(bypassDiv);
        }
        
        // === 新增: 正则过滤信息 ===
        if (chain.regexFilters && chain.regexFilters.length > 0) {
            const filterDiv = document.createElement('div');
            filterDiv.className = 'mt-2 p-2 rounded';
            filterDiv.style.backgroundColor = '#402000';
            filterDiv.style.border = '1px solid #ff9800';
            
            let filterHtml = '<div class="text-warning small fw-bold mb-1">🛡️ 检测到的过滤器:</div>';
            chain.regexFilters.forEach((filter, idx) => {
                filterHtml += `<div class="mb-1">`;
                filterHtml += `<code class="small text-danger">${escapeHtml(filter.pattern)}</code>`;
                if (filter.blockedKeywords && filter.blockedKeywords.length > 0) {
                    filterHtml += `<div class="ms-2 small text-muted">阻止: ${filter.blockedKeywords.join(', ')}</div>`;
                }
                filterHtml += `</div>`;
            });
            
            filterDiv.innerHTML = filterHtml;
            body.appendChild(filterDiv);
        }
        
        // === 新增: 绕过建议 ===
        if (chain.bypassHints && chain.bypassHints.length > 0) {
            const hintsDiv = document.createElement('div');
            hintsDiv.className = 'mt-2 p-2 rounded';
            hintsDiv.style.backgroundColor = '#003320';
            hintsDiv.style.border = '1px solid #4CAF50';
            
            let hintsHtml = '<div class="text-success small fw-bold mb-1">💡 绕过建议:</div>';
            chain.bypassHints.forEach(hint => {
                hintsHtml += `<div class="small text-light mb-1">• ${hint}</div>`;
            });
            
            hintsDiv.innerHTML = hintsHtml;
            body.appendChild(hintsDiv);
        }
        
        // === 新增: 漏洞类型标签 ===
        if (chain.vulnType) {
            const vulnTypes = {
                'pop_chain': { label: 'POP链', color: 'danger' },
                'property_injection': { label: '属性注入', color: 'warning' },
                'dynamic_rce': { label: '动态RCE', color: 'danger' },
                'file_read': { label: '文件读取', color: 'info' },
                'file_write': { label: '文件写入', color: 'warning' }
            };
            
            const vulnInfo = vulnTypes[chain.vulnType] || { label: chain.vulnType, color: 'secondary' };
            
            const vulnBadge = document.createElement('div');
            vulnBadge.className = 'mt-2 text-center';
            vulnBadge.innerHTML = `<span class="badge bg-${vulnInfo.color} px-3 py-2">${vulnInfo.label}</span>`;
            body.appendChild(vulnBadge);
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
        
        // 新增: 复制利用URL按钮
        if (chain.paramName) {
            const copyUrlBtn = document.createElement('button');
            copyUrlBtn.className = 'btn btn-outline-success btn-sm';
            copyUrlBtn.innerHTML = '🔗 复制URL';
            copyUrlBtn.onclick = function() {
                const url = `?${chain.paramName}=${encodeURIComponent(chain.payload || '')}`;
                navigator.clipboard.writeText(url).then(() => {
                    showNotification('利用URL已复制!', 'success');
                });
            };
            btnGroup.appendChild(copyUrlBtn);
        }
        
        body.appendChild(btnGroup);
        
        chainDiv.appendChild(body);
        detailsDiv.appendChild(chainDiv);
    }
}

// HTML 转义函数
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
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
    
    // Create main container
    const container = document.createElement('div');
    container.className = 'node-details-container';
    
    // Title with icon based on type
    const typeIcons = {
        'class': '📦',
        'method': '⚙️',
        'magic': '✨',
        'property': '🏷️',
        'source': '📥',
        'sink': '💀',
        'entry': '🎯',
        'chain': '⛓️'
    };
    
    const h6 = document.createElement('h6');
    h6.className = 'text-warning mb-2';
    h6.innerHTML = `${typeIcons[data.type] || '📍'} ${data.label}`;
    container.appendChild(h6);
    
    // Type badge with color
    const typeBadge = document.createElement('p');
    const badgeColors = {
        'class': 'bg-primary',
        'method': 'bg-success',
        'magic': 'bg-danger',
        'property': 'bg-info',
        'source': 'bg-warning text-dark',
        'sink': 'bg-danger',
        'entry': 'bg-success',
        'chain': 'bg-warning text-dark'
    };
    const badge = document.createElement('span');
    badge.className = `badge ${badgeColors[data.type] || 'bg-secondary'}`;
    badge.textContent = data.type?.toUpperCase() || 'UNKNOWN';
    typeBadge.appendChild(badge);
    container.appendChild(typeBadge);
    
    // === Enhanced details based on node type ===
    
    // For class nodes
    if (data.type === 'class' && data.metadata) {
        const classInfo = document.createElement('div');
        classInfo.className = 'bg-dark p-2 rounded mb-2';
        classInfo.style.border = '1px solid #3a3a5c';
        
        let classHtml = '<div class="text-info small fw-bold mb-1">📊 类信息:</div>';
        
        if (data.metadata.extends) {
            classHtml += `<div><span class="text-warning">继承:</span> <code class="text-light">${data.metadata.extends}</code></div>`;
        }
        if (data.metadata.implements && data.metadata.implements.length > 0) {
            classHtml += `<div><span class="text-success">实现:</span> <code class="text-light">${data.metadata.implements.join(', ')}</code></div>`;
        }
        if (data.metadata.properties) {
            classHtml += `<div><span class="text-info">属性数:</span> <span class="text-light">${data.metadata.properties}</span></div>`;
        }
        if (data.metadata.methods) {
            classHtml += `<div><span class="text-info">方法数:</span> <span class="text-light">${data.metadata.methods}</span></div>`;
        }
        if (data.metadata.hasMagicMethods) {
            classHtml += `<div class="text-danger mt-1">⚠️ 包含魔术方法</div>`;
        }
        
        classInfo.innerHTML = classHtml;
        container.appendChild(classInfo);
    }
    
    // For method nodes
    if ((data.type === 'method' || data.type === 'magic') && data.metadata) {
        const methodInfo = document.createElement('div');
        methodInfo.className = 'bg-dark p-2 rounded mb-2';
        methodInfo.style.border = '1px solid #3a3a5c';
        
        let methodHtml = '<div class="text-info small fw-bold mb-1">⚙️ 方法信息:</div>';
        
        if (data.metadata.visibility) {
            const visColors = { 'public': 'text-success', 'protected': 'text-warning', 'private': 'text-danger' };
            methodHtml += `<div><span class="text-muted">可见性:</span> <span class="${visColors[data.metadata.visibility] || 'text-light'}">${data.metadata.visibility}</span></div>`;
        }
        if (data.metadata.parameters && data.metadata.parameters.length > 0) {
            methodHtml += `<div><span class="text-muted">参数:</span> <code class="text-info">(${data.metadata.parameters.join(', ')})</code></div>`;
        }
        if (data.metadata.returns) {
            methodHtml += `<div><span class="text-muted">返回:</span> <code class="text-light">${data.metadata.returns}</code></div>`;
        }
        if (data.metadata.dangerousCalls && data.metadata.dangerousCalls.length > 0) {
            methodHtml += `<div class="mt-1 text-danger">🔥 危险调用:</div>`;
            data.metadata.dangerousCalls.forEach(call => {
                methodHtml += `<div class="ms-2"><code class="text-danger">${call}</code></div>`;
            });
        }
        if (data.metadata.triggers && data.metadata.triggers.length > 0) {
            methodHtml += `<div class="mt-1 text-warning">⚡ 触发器:</div>`;
            data.metadata.triggers.forEach(trigger => {
                methodHtml += `<div class="ms-2 small text-muted">${trigger}</div>`;
            });
        }
        
        methodInfo.innerHTML = methodHtml;
        container.appendChild(methodInfo);
    }
    
    // For sink nodes
    if (data.type === 'sink' && data.metadata) {
        const sinkInfo = document.createElement('div');
        sinkInfo.className = 'bg-danger bg-opacity-25 p-2 rounded mb-2';
        sinkInfo.style.border = '1px solid #dc3545';
        
        let sinkHtml = '<div class="text-danger small fw-bold mb-1">💀 危险操作:</div>';
        
        if (data.metadata.function) {
            sinkHtml += `<div><span class="text-muted">函数:</span> <code class="text-danger">${data.metadata.function}</code></div>`;
        }
        if (data.metadata.riskLevel) {
            const riskColors = { 'critical': 'text-danger', 'high': 'text-warning', 'medium': 'text-info' };
            sinkHtml += `<div><span class="text-muted">风险等级:</span> <span class="${riskColors[data.metadata.riskLevel] || 'text-light'}">${data.metadata.riskLevel.toUpperCase()}</span></div>`;
        }
        if (data.metadata.exploitType) {
            sinkHtml += `<div><span class="text-muted">利用类型:</span> <span class="text-warning">${data.metadata.exploitType}</span></div>`;
        }
        
        sinkInfo.innerHTML = sinkHtml;
        container.appendChild(sinkInfo);
    }
    
    // For entry nodes (unserialize)
    if (data.type === 'entry' && data.metadata) {
        const entryInfo = document.createElement('div');
        entryInfo.className = 'bg-success bg-opacity-25 p-2 rounded mb-2';
        entryInfo.style.border = '1px solid #28a745';
        
        let entryHtml = '<div class="text-success small fw-bold mb-1">🎯 入口点信息:</div>';
        
        if (data.metadata.paramSource) {
            entryHtml += `<div><span class="text-muted">参数来源:</span> <code class="text-info">${data.metadata.paramSource}</code></div>`;
        }
        if (data.metadata.paramName) {
            entryHtml += `<div><span class="text-muted">参数名:</span> <code class="text-warning">${data.metadata.paramName}</code></div>`;
        }
        if (data.metadata.isBase64) {
            entryHtml += `<div class="text-info mt-1">📦 需要 Base64 编码</div>`;
        }
        
        entryInfo.innerHTML = entryHtml;
        container.appendChild(entryInfo);
    }
    
    // Line number with highlight button
    if (data.metadata && data.metadata.line) {
        const lineDiv = document.createElement('div');
        lineDiv.className = 'd-flex justify-content-between align-items-center mt-2';
        
        const linePara = document.createElement('span');
        linePara.innerHTML = `<strong class="text-muted">📍 Line:</strong> <span class="text-light">${data.metadata.line}</span>`;
        lineDiv.appendChild(linePara);
        
        const highlightBtn = document.createElement('button');
        highlightBtn.className = 'btn btn-warning btn-sm';
        highlightBtn.innerHTML = '🎯 定位';
        highlightBtn.onclick = function() {
            highlightInVSCode(data.metadata.line, data.metadata.column || 0);
        };
        lineDiv.appendChild(highlightBtn);
        
        container.appendChild(lineDiv);
    }
    
    // Connected nodes info
    const connectedInfo = document.createElement('div');
    connectedInfo.className = 'mt-3 p-2 bg-dark rounded';
    connectedInfo.style.border = '1px solid #3a3a5c';
    
    const incomers = node.incomers('edge');
    const outgoers = node.outgoers('edge');
    
    let connHtml = '<div class="text-info small fw-bold mb-1">🔗 连接信息:</div>';
    connHtml += `<div><span class="text-success">← 入边:</span> <span class="text-light">${incomers.length}</span></div>`;
    connHtml += `<div><span class="text-warning">→ 出边:</span> <span class="text-light">${outgoers.length}</span></div>`;
    
    if (incomers.length > 0) {
        connHtml += '<div class="mt-1 small text-muted">来自:</div>';
        incomers.slice(0, 5).forEach(edge => {
            const source = edge.source();
            connHtml += `<div class="ms-2 small"><code class="text-info">${source.data('label')}</code> <span class="text-muted">(${edge.data('type')})</span></div>`;
        });
        if (incomers.length > 5) {
            connHtml += `<div class="ms-2 small text-muted">... 还有 ${incomers.length - 5} 个</div>`;
        }
    }
    
    if (outgoers.length > 0) {
        connHtml += '<div class="mt-1 small text-muted">到达:</div>';
        outgoers.slice(0, 5).forEach(edge => {
            const target = edge.target();
            connHtml += `<div class="ms-2 small"><code class="text-warning">${target.data('label')}</code> <span class="text-muted">(${edge.data('type')})</span></div>`;
        });
        if (outgoers.length > 5) {
            connHtml += `<div class="ms-2 small text-muted">... 还有 ${outgoers.length - 5} 个</div>`;
        }
    }
    
    connectedInfo.innerHTML = connHtml;
    container.appendChild(connectedInfo);
    
    // Action buttons
    const btnGroup = document.createElement('div');
    btnGroup.className = 'd-flex gap-2 mt-3';
    
    const focusBtn = document.createElement('button');
    focusBtn.className = 'btn btn-outline-info btn-sm flex-grow-1';
    focusBtn.innerHTML = '🔍 聚焦';
    focusBtn.onclick = function() {
        cy.animate({
            center: { eles: node },
            zoom: 2,
            duration: 500
        });
    };
    btnGroup.appendChild(focusBtn);
    
    const neighborsBtn = document.createElement('button');
    neighborsBtn.className = 'btn btn-outline-warning btn-sm flex-grow-1';
    neighborsBtn.innerHTML = '👁️ 邻居';
    neighborsBtn.onclick = function() {
        cy.elements().addClass('filtered');
        node.removeClass('filtered');
        node.neighborhood().removeClass('filtered');
    };
    btnGroup.appendChild(neighborsBtn);
    
    container.appendChild(btnGroup);
    
    detailsDiv.appendChild(container);
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
        classes: cy.nodes().filter(n => n.data('type') === 'class').length,
        methods: cy.nodes().filter(n => n.data('type') === 'method').length,
        magicMethods: cy.nodes().filter(n => n.data('type') === 'magic').length,
        properties: cy.nodes().filter(n => n.data('type') === 'property').length,
        sources: cy.nodes().filter(n => n.data('type') === 'source').length,
        sinks: cy.nodes().filter(n => n.data('type') === 'sink').length,
        entryPoints: cy.nodes().filter(n => n.data('type') === 'entry').length,
        chainNodes: cy.nodes().filter(n => n.data('type') === 'chain').length,
        taintedNodes: cy.nodes().filter(n => n.data('metadata')?.isTainted === true).length,
        edgeTypes: {},
        vulnerabilities: {
            critical: 0,
            high: 0,
            medium: 0,
            low: 0
        }
    };
    
    // Count edges by type
    cy.edges().forEach(edge => {
        const type = edge.data('type') || 'unknown';
        stats.edgeTypes[type] = (stats.edgeTypes[type] || 0) + 1;
        
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
    
    // === 节点统计 ===
    const nodeSection = document.createElement('div');
    nodeSection.className = 'mb-3';
    nodeSection.innerHTML = `
        <div class="text-info small fw-bold mb-2">📊 节点统计</div>
        <div class="row g-1">
            <div class="col-6">
                <div class="bg-dark p-2 rounded text-center">
                    <div class="text-warning fw-bold">${stats.nodes}</div>
                    <div class="small text-muted">总节点</div>
                </div>
            </div>
            <div class="col-6">
                <div class="bg-dark p-2 rounded text-center">
                    <div class="text-info fw-bold">${stats.edges}</div>
                    <div class="small text-muted">总边数</div>
                </div>
            </div>
        </div>
    `;
    statsDiv.appendChild(nodeSection);
    
    // === 类型分布 ===
    const typeSection = document.createElement('div');
    typeSection.className = 'mb-3 bg-dark p-2 rounded';
    typeSection.style.border = '1px solid #3a3a5c';
    
    let typeHtml = '<div class="text-info small fw-bold mb-2">📦 类型分布</div>';
    
    const typeItems = [
        { label: '类', value: stats.classes, color: 'primary', icon: '📦' },
        { label: '方法', value: stats.methods, color: 'success', icon: '⚙️' },
        { label: '魔术方法', value: stats.magicMethods, color: 'danger', icon: '✨' },
        { label: '属性', value: stats.properties, color: 'info', icon: '🏷️' },
        { label: '入口点', value: stats.entryPoints, color: 'success', icon: '🎯' },
        { label: '危险点', value: stats.sinks, color: 'danger', icon: '💀' }
    ];
    
    typeItems.forEach(item => {
        if (item.value > 0) {
            typeHtml += `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="small">${item.icon} ${item.label}</span>
                    <span class="badge bg-${item.color}">${item.value}</span>
                </div>
            `;
        }
    });
    
    typeSection.innerHTML = typeHtml;
    statsDiv.appendChild(typeSection);
    
    // === 边类型统计 ===
    if (Object.keys(stats.edgeTypes).length > 0) {
        const edgeSection = document.createElement('div');
        edgeSection.className = 'mb-3 bg-dark p-2 rounded';
        edgeSection.style.border = '1px solid #3a3a5c';
        
        let edgeHtml = '<div class="text-info small fw-bold mb-2">🔗 边类型</div>';
        
        const edgeColors = {
            'extends': 'danger',
            'implements': 'success',
            'contains': 'secondary',
            'calls': 'primary',
            'triggers': 'warning',
            'dataflow': 'info',
            'invokes': 'danger',
            'property_flow': 'info'
        };
        
        Object.entries(stats.edgeTypes).forEach(([type, count]) => {
            const color = edgeColors[type] || 'secondary';
            edgeHtml += `
                <div class="d-flex justify-content-between align-items-center mb-1">
                    <span class="small text-light">${type}</span>
                    <span class="badge bg-${color}">${count}</span>
                </div>
            `;
        });
        
        edgeSection.innerHTML = edgeHtml;
        statsDiv.appendChild(edgeSection);
    }
    
    // === 安全统计 ===
    const securitySection = document.createElement('div');
    securitySection.className = 'mb-3 bg-dark p-2 rounded';
    securitySection.style.border = '1px solid #dc3545';
    
    const totalVulns = stats.vulnerabilities.critical + stats.vulnerabilities.high + 
                       stats.vulnerabilities.medium + stats.vulnerabilities.low;
    
    let secHtml = '<div class="text-danger small fw-bold mb-2">🔒 安全分析</div>';
    
    if (totalVulns > 0 || stats.sinks > 0 || stats.entryPoints > 0) {
        secHtml += `
            <div class="d-flex justify-content-between mb-1">
                <span class="small text-light">入口点</span>
                <span class="badge bg-success">${stats.entryPoints}</span>
            </div>
            <div class="d-flex justify-content-between mb-1">
                <span class="small text-light">危险调用</span>
                <span class="badge bg-danger">${stats.sinks}</span>
            </div>
        `;
        
        if (stats.vulnerabilities.critical > 0) {
            secHtml += `
                <div class="d-flex justify-content-between mb-1">
                    <span class="small text-danger">🔴 严重</span>
                    <span class="badge bg-danger">${stats.vulnerabilities.critical}</span>
                </div>
            `;
        }
        if (stats.vulnerabilities.high > 0) {
            secHtml += `
                <div class="d-flex justify-content-between mb-1">
                    <span class="small text-warning">🟠 高危</span>
                    <span class="badge bg-warning text-dark">${stats.vulnerabilities.high}</span>
                </div>
            `;
        }
        
        // 风险评估
        let riskLevel = '低';
        let riskColor = 'success';
        if (stats.vulnerabilities.critical > 0 || (stats.entryPoints > 0 && stats.sinks > 0)) {
            riskLevel = '严重';
            riskColor = 'danger';
        } else if (stats.vulnerabilities.high > 0 || stats.sinks > 0) {
            riskLevel = '高';
            riskColor = 'warning';
        } else if (stats.magicMethods > 0) {
            riskLevel = '中';
            riskColor = 'info';
        }
        
        secHtml += `
            <div class="mt-2 p-2 rounded text-center" style="background-color: ${riskColor === 'danger' ? '#4d0f0f' : riskColor === 'warning' ? '#4d3f0f' : '#0f4d0f'};">
                <span class="small text-muted">综合风险:</span>
                <span class="badge bg-${riskColor} ms-1">${riskLevel}</span>
            </div>
        `;
    } else {
        secHtml += '<div class="small text-muted">暂无安全问题</div>';
    }
    
    securitySection.innerHTML = secHtml;
    statsDiv.appendChild(securitySection);
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
 * Show only class nodes
 */
function showClassesOnly() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show class and interface nodes
    cy.nodes().filter(n => 
        n.data('type') === 'class' || 
        n.data('type') === 'interface'
    ).removeClass('filtered');
    
    // Show extends and implements edges
    const classEdges = cy.edges().filter(e => 
        e.data('type') === 'extends' || 
        e.data('type') === 'implements'
    );
    classEdges.removeClass('filtered');
    
    showNotification('Showing classes and interfaces only', 'info');
}

/**
 * Show only methods
 */
function showMethodsOnly() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show method and magic method nodes
    cy.nodes().filter(n => 
        n.data('type') === 'method' || 
        n.data('type') === 'magic' ||
        n.data('type') === 'function'
    ).removeClass('filtered');
    
    // Show call edges
    const callEdges = cy.edges().filter(e => 
        e.data('type') === 'calls' || 
        e.data('type') === 'triggers'
    );
    callEdges.removeClass('filtered');
    callEdges.connectedNodes().removeClass('filtered');
    
    showNotification('Showing methods only', 'info');
}

/**
 * Show only data flow (sources -> variables -> sinks)
 */
function showDataFlow() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show sources, sinks, variables, and properties
    cy.nodes().filter(n => 
        n.data('type') === 'source' || 
        n.data('type') === 'sink' || 
        n.data('type') === 'variable' ||
        n.data('type') === 'property'
    ).removeClass('filtered');
    
    // Show dataflow edges
    const flowEdges = cy.edges().filter(e => 
        e.data('type') === 'dataflow' || 
        e.data('type') === 'calls_dangerous'
    );
    flowEdges.removeClass('filtered');
    flowEdges.connectedNodes().removeClass('filtered');
    
    showNotification('Showing data flow paths', 'info');
}

/**
 * Change graph layout
 */
function changeLayout(layoutName) {
    if (!cy) { return; }
    
    let layoutOptions = {
        name: layoutName,
        fit: true,
        padding: 50,
        animate: true,
        animationDuration: 500
    };
    
    // Add specific options for each layout
    switch (layoutName) {
        case 'dagre':
            layoutOptions = {
                ...layoutOptions,
                rankDir: 'TB',
                nodeSep: 80,
                rankSep: 100,
                edgeSep: 50
            };
            break;
        case 'cose':
            layoutOptions = {
                ...layoutOptions,
                idealEdgeLength: 100,
                nodeOverlap: 20,
                nodeRepulsion: 400000,
                gravity: 80
            };
            break;
        case 'breadthfirst':
            layoutOptions = {
                ...layoutOptions,
                directed: true,
                spacingFactor: 1.5
            };
            break;
        case 'concentric':
            layoutOptions = {
                ...layoutOptions,
                minNodeSpacing: 50,
                concentric: function(node) {
                    // Entry nodes at center, sinks at outer ring
                    const type = node.data('type');
                    if (type === 'entry') return 10;
                    if (type === 'source') return 8;
                    if (type === 'class') return 6;
                    if (type === 'method' || type === 'magic') return 4;
                    if (type === 'property' || type === 'variable') return 2;
                    if (type === 'sink') return 0;
                    return 5;
                },
                levelWidth: function() { return 2; }
            };
            break;
    }
    
    cy.layout(layoutOptions).run();
    showNotification(`Layout changed to ${layoutName}`, 'info');
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
 * Show only functions (global functions and methods)
 */
function showFunctionsOnly() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show function and method nodes
    cy.nodes().filter(n => 
        n.data('type') === 'function' ||
        n.data('type') === 'method' ||
        n.data('type') === 'magic'
    ).removeClass('filtered');
    
    // Show call edges
    const callEdges = cy.edges().filter(e => 
        e.data('type') === 'calls' ||
        e.data('type') === 'has_method'
    );
    callEdges.removeClass('filtered');
    callEdges.connectedNodes().removeClass('filtered');
    
    showNotification('Showing functions and methods', 'info');
}

/**
 * Show call graph - all call relationships
 */
function showCallGraph() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show all call edges
    const callEdges = cy.edges().filter(e => 
        e.data('type') === 'calls' ||
        e.data('type') === 'triggers' ||
        e.data('type') === 'calls_dangerous'
    );
    
    callEdges.removeClass('filtered');
    callEdges.connectedNodes().removeClass('filtered');
    
    showNotification(`Showing call graph with ${callEdges.length} call(s)`, 'info');
}

/**
 * Show variables and data flow
 */
function showVariablesAndFlow() {
    if (!cy) { return; }
    
    cy.elements().addClass('filtered');
    
    // Show variable, source, sink nodes
    cy.nodes().filter(n => 
        n.data('type') === 'variable' ||
        n.data('type') === 'source' ||
        n.data('type') === 'sink' ||
        n.data('type') === 'property'
    ).removeClass('filtered');
    
    // Show data flow edges
    const flowEdges = cy.edges().filter(e => 
        e.data('type') === 'dataflow' ||
        e.data('type') === 'assigns' ||
        e.data('type') === 'uses' ||
        e.data('type') === 'calls_dangerous'
    );
    flowEdges.removeClass('filtered');
    flowEdges.connectedNodes().removeClass('filtered');
    
    showNotification('Showing variables and data flow', 'info');
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
