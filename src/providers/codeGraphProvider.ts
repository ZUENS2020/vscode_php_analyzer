import * as vscode from 'vscode';
import { CodeGraph, GraphNode, GraphEdge, DataSource, DataSink, Entity, Relationship, DataFlowPath, ObjectRelation, PropertyAccess, MethodCall, CallRelation, Condition } from '../types';
import { DataFlowAnalyzer } from '../analyzers/dataFlowAnalyzer';
import { ObjectRelationAnalyzer } from '../analyzers/objectRelationAnalyzer';
import { CallGraphAnalyzer } from '../analyzers/callGraphAnalyzer';
import { ConditionalPathAnalyzer } from '../analyzers/conditionalPathAnalyzer';
import { MagicMethodChainAnalyzer } from '../analyzers/magicMethodChainAnalyzer';
import { PHPAnalyzer } from '../analyzers/phpAnalyzer';

export class CodeGraphProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;
    private currentGraph?: CodeGraph;

    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this.getHtmlContent(webviewView.webview);

        // Handle messages from webview
        webviewView.webview.onDidReceiveMessage(data => {
            switch (data.type) {
                case 'nodeClicked':
                    this.handleNodeClick(data.nodeId);
                    break;
            }
        });

        // Show current graph if available
        if (this.currentGraph) {
            this.updateGraph(this.currentGraph);
        }
    }

    async showCodeGraph(ast: any, document: vscode.TextDocument) {
        const graph = this.buildCodeGraph(ast, document);
        this.currentGraph = graph;
        this.updateGraph(graph);
    }

    async showInheritanceGraph(ast: any, document: vscode.TextDocument) {
        const graph = this.buildInheritanceGraph(ast, document);
        this.currentGraph = graph;
        this.updateGraph(graph);
    }

    async showDataFlowGraph(ast: any, document: vscode.TextDocument) {
        const graph = this.buildDataFlowGraph(ast, document);
        this.currentGraph = graph;
        this.updateGraph(graph);
    }

    async highlightAttackPaths(attackChains: any[]) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'highlightPaths',
                paths: attackChains
            });
        }
    }

    public buildCodeGraph(ast: any, document: vscode.TextDocument): CodeGraph {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const nodeIds = new Set<string>();

        const phpAnalyzer = new PHPAnalyzer('');
        phpAnalyzer['ast'] = ast;

        // 1. Add unserialize entry points
        const magicAnalyzer = new MagicMethodChainAnalyzer(ast, document);
        const unserializeEntries = magicAnalyzer.findUnserializeEntries();
        
        unserializeEntries.forEach((entry, index) => {
            const entryId = `entry_unserialize_${index}`;
            nodeIds.add(entryId);
            nodes.push({
                id: entryId,
                label: 'unserialize($_GET[...])',
                type: 'entry',
                metadata: {
                    line: entry.line,
                    column: entry.column
                }
            });
        });

        // 2. Add all class nodes with inheritance relationships
        const classes = phpAnalyzer.getAllClasses();
        const classMap = new Map<string, any>();
        
        for (const classNode of classes) {
            const className = classNode.name?.name || 'Unknown';
            classMap.set(className, classNode);
            
            const classId = `class_${className}`;
            if (!nodeIds.has(classId)) {
                nodeIds.add(classId);
                nodes.push({
                    id: classId,
                    label: className,
                    type: 'class',
                    metadata: {
                        line: phpAnalyzer.getNodeLocation(classNode)?.line
                    }
                });
            }

            // Add extends relationship
            if (classNode.extends) {
                const parentName = classNode.extends.name || 'Unknown';
                const parentId = `class_${parentName}`;
                
                // Add parent class node if not exists
                if (!nodeIds.has(parentId)) {
                    nodeIds.add(parentId);
                    nodes.push({
                        id: parentId,
                        label: parentName,
                        type: 'class'
                    });
                }

                edges.push({
                    source: classId,
                    target: parentId,
                    type: 'extends',
                    label: 'extends'
                });
            }

            // Add implements relationships
            if (classNode.implements) {
                for (const iface of classNode.implements) {
                    const ifaceName = iface.name || 'Unknown';
                    const ifaceId = `interface_${ifaceName}`;
                    
                    if (!nodeIds.has(ifaceId)) {
                        nodeIds.add(ifaceId);
                        nodes.push({
                            id: ifaceId,
                            label: ifaceName,
                            type: 'class'
                        });
                    }

                    edges.push({
                        source: classId,
                        target: ifaceId,
                        type: 'implements',
                        label: 'implements'
                    });
                }
            }
        }

        // 3. Add method nodes and analyze magic method chains
        const magicChains = magicAnalyzer.traceChains();
        
        for (const classNode of classes) {
            const className = classNode.name?.name || 'Unknown';
            const classId = `class_${className}`;
            
            if (!classNode.body) {
                continue;
            }

            for (const member of classNode.body) {
                if (member.kind === 'method') {
                    const methodName = member.name?.name || member.name || 'unknown';
                    const methodId = `method_${className}_${methodName}`;
                    const isMagic = this.isMagicMethod(methodName);
                    
                    if (!nodeIds.has(methodId)) {
                        nodeIds.add(methodId);
                        nodes.push({
                            id: methodId,
                            label: `${className}::${methodName}`,
                            type: isMagic ? 'magic' : 'method',
                            metadata: {
                                line: phpAnalyzer.getNodeLocation(member)?.line
                            }
                        });
                    }

                    edges.push({
                        source: classId,
                        target: methodId,
                        type: 'contains'
                    });

                    // Connect unserialize to __wakeup
                    if (methodName === '__wakeup' && unserializeEntries.length > 0) {
                        unserializeEntries.forEach((entry, index) => {
                            edges.push({
                                source: `entry_unserialize_${index}`,
                                target: methodId,
                                type: 'triggers',
                                label: 'triggers'
                            });
                        });
                    }
                }
            }
        }

        // 4. Add magic method trigger chains
        for (const chain of magicChains) {
            const entryMethodId = chain.entryPoint.replace('::', '_');
            const entryNodeId = `method_${entryMethodId}`;

            for (const trigger of chain.chain) {
                if (trigger.methodName.startsWith('__')) {
                    const triggerId = `trigger_${trigger.className}_${trigger.methodName}_${trigger.line}`;
                    
                    if (!nodeIds.has(triggerId)) {
                        nodeIds.add(triggerId);
                        nodes.push({
                            id: triggerId,
                            label: `${trigger.className}::${trigger.methodName}`,
                            type: 'magic',
                            metadata: {
                                line: trigger.line,
                                column: trigger.column
                            }
                        });
                    }

                    // Connect the entry method to the triggered magic method
                    if (nodeIds.has(entryNodeId)) {
                        edges.push({
                            source: entryNodeId,
                            target: triggerId,
                            type: 'triggers',
                            label: trigger.triggeredBy
                        });
                    }
                }
            }

            // 5. Add property flow nodes
            for (const flow of chain.propertyFlows) {
                const propId = `prop_${flow.fromClass}_${flow.propertyName}`;
                
                if (!nodeIds.has(propId)) {
                    nodeIds.add(propId);
                    nodes.push({
                        id: propId,
                        label: `$this->${flow.propertyName}`,
                        type: 'property',
                        metadata: {
                            line: flow.line,
                            column: flow.column
                        }
                    });
                }

                // Connect property to the method that uses it
                if (nodeIds.has(entryNodeId)) {
                    edges.push({
                        source: `class_${flow.fromClass}`,
                        target: propId,
                        type: 'contains'
                    });

                    edges.push({
                        source: propId,
                        target: entryNodeId,
                        type: 'dataflow',
                        label: `flows to ${flow.toVariable}`
                    });
                }
            }

            // 6. Add dangerous sink nodes
            for (const sink of chain.dangerousSinks) {
                const sinkId = `sink_${sink}_${chain.entryPoint}`;
                
                if (!nodeIds.has(sinkId)) {
                    nodeIds.add(sinkId);
                    nodes.push({
                        id: sinkId,
                        label: `${sink}()`,
                        type: 'sink'
                    });
                }

                if (nodeIds.has(entryNodeId)) {
                    edges.push({
                        source: entryNodeId,
                        target: sinkId,
                        type: 'calls',
                        label: 'calls'
                    });
                }
            }
        }

        return { nodes, edges };
    }

    public buildInheritanceGraph(ast: any, document: vscode.TextDocument): CodeGraph {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        if (ast.children) {
            for (const child of ast.children) {
                if (child.kind === 'class') {
                    const className = child.name?.name || 'Unknown';
                    nodes.push({
                        id: `class_${className}`,
                        label: className,
                        type: 'class'
                    });

                    // Add extends relationship
                    if (child.extends) {
                        const parentName = child.extends.name || 'Unknown';
                        nodes.push({
                            id: `class_${parentName}`,
                            label: parentName,
                            type: 'class'
                        });

                        edges.push({
                            source: `class_${className}`,
                            target: `class_${parentName}`,
                            type: 'extends',
                            label: 'extends'
                        });
                    }

                    // Add implements relationships
                    if (child.implements) {
                        for (const iface of child.implements) {
                            const ifaceName = iface.name || 'Unknown';
                            nodes.push({
                                id: `interface_${ifaceName}`,
                                label: ifaceName,
                                type: 'class'
                            });

                            edges.push({
                                source: `class_${className}`,
                                target: `interface_${ifaceName}`,
                                type: 'implements',
                                label: 'implements'
                            });
                        }
                    }
                }
            }
        }

        return { nodes, edges };
    }

    public buildDataFlowGraph(ast: any, document: vscode.TextDocument): CodeGraph {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        try {
            // Run data flow analysis
            const dataFlowAnalyzer = new DataFlowAnalyzer(ast, document);
            const dataFlowAnalysis = dataFlowAnalyzer.analyze();

            // Add sources to nodes
            dataFlowAnalysis.sources.forEach((source: DataSource) => {
                nodes.push({
                    id: source.id,
                    label: source.name,
                    type: 'source',
                    metadata: {
                        sourceType: source.type,
                        isTainted: source.isTainted,
                        line: source.line,
                        column: source.column
                    }
                });
            });

            // Add sinks to nodes
            dataFlowAnalysis.sinks.forEach((sink: DataSink) => {
                nodes.push({
                    id: sink.id,
                    label: sink.name,
                    type: 'sink',
                    metadata: {
                        sinkType: sink.type,
                        severity: sink.severity,
                        line: sink.line,
                        column: sink.column
                    }
                });
            });

            // Add entities (transformers, variables, functions, objects)
            dataFlowAnalysis.entities.forEach((entity: Entity) => {
                // Skip sources and sinks (already added)
                if (entity.type !== 'source' && entity.type !== 'sink') {
                    // Map entity type to GraphNode type
                    let nodeType: GraphNode['type'] = 'method';
                    if (entity.type === 'function') {
                        nodeType = 'method';
                    } else if (entity.type === 'object') {
                        nodeType = 'class';
                    } else if (entity.type === 'variable') {
                        nodeType = 'property';
                    } else if (entity.type === 'transformer') {
                        nodeType = 'method';
                    }
                    
                    nodes.push({
                        id: entity.id,
                        label: entity.name,
                        type: nodeType,
                        metadata: {
                            isTainted: entity.isTainted,
                            line: entity.line,
                            column: entity.column,
                            value: entity.value
                        }
                    });
                }
            });

            // Add relationships as edges
            dataFlowAnalysis.relationships.forEach((rel: Relationship) => {
                edges.push({
                    source: rel.source.id,
                    target: rel.target.id,
                    type: 'dataflow',
                    label: rel.type,
                    metadata: {
                        isTainted: rel.isTainted,
                        conditions: rel.conditions
                    }
                });
            });

            // Add data flow paths as highlighted edges
            dataFlowAnalysis.paths.forEach((path: DataFlowPath) => {
                // Connect source to first path node
                if (path.path.length > 0) {
                    edges.push({
                        source: path.source.id,
                        target: path.path[0].id,
                        type: 'dataflow',
                        label: 'flows to',
                        metadata: {
                            isTainted: path.isTainted,
                            vulnerabilityType: path.vulnerabilityType,
                            severity: path.severity
                        }
                    });

                    // Connect path nodes
                    for (let i = 0; i < path.path.length - 1; i++) {
                        edges.push({
                            source: path.path[i].id,
                            target: path.path[i + 1].id,
                            type: 'dataflow',
                            label: path.path[i].operation || 'flows to',
                            metadata: {
                                isTainted: path.isTainted
                            }
                        });
                    }

                    // Connect last path node to sink
                    if (path.path.length > 0) {
                        edges.push({
                            source: path.path[path.path.length - 1].id,
                            target: path.sink.id,
                            type: 'dataflow',
                            label: 'reaches',
                            metadata: {
                                isTainted: path.isTainted,
                                vulnerabilityType: path.vulnerabilityType,
                                severity: path.severity
                            }
                        });
                    }
                } else {
                    // Direct connection from source to sink
                    edges.push({
                        source: path.source.id,
                        target: path.sink.id,
                        type: 'dataflow',
                        label: 'direct flow',
                        metadata: {
                            isTainted: path.isTainted,
                            vulnerabilityType: path.vulnerabilityType,
                            severity: path.severity
                        }
                    });
                }
            });

            // Run object relation analysis
            const objectAnalyzer = new ObjectRelationAnalyzer(ast, document);
            const objectRelations = objectAnalyzer.analyze();

            // Add object nodes and edges
            objectRelations.forEach((objRel: ObjectRelation) => {
                const objNodeId = `object_${objRel.objectName}`;
                nodes.push({
                    id: objNodeId,
                    label: `${objRel.objectName} (${objRel.className})`,
                    type: 'class',
                    metadata: {
                        className: objRel.className,
                        line: objRel.line,
                        column: objRel.column
                    }
                });

                // Add property access edges
                objRel.properties.forEach((prop: PropertyAccess) => {
                    const propNodeId = `prop_${objRel.objectName}_${prop.propertyName}`;
                    nodes.push({
                        id: propNodeId,
                        label: prop.propertyName,
                        type: 'property',
                        metadata: {
                            isWrite: prop.isWrite,
                            isTainted: prop.isTainted
                        }
                    });

                    edges.push({
                        source: objNodeId,
                        target: propNodeId,
                        type: 'contains',
                        label: prop.isWrite ? 'writes' : 'reads'
                    });
                });

                // Add method call edges
                objRel.methods.forEach((method: MethodCall) => {
                    const methodNodeId = `method_${objRel.objectName}_${method.methodName}_${method.line}`;
                    nodes.push({
                        id: methodNodeId,
                        label: `${method.methodName}()`,
                        type: 'method',
                        metadata: {
                            isTainted: method.isTainted,
                            arguments: method.arguments
                        }
                    });

                    edges.push({
                        source: objNodeId,
                        target: methodNodeId,
                        type: 'calls',
                        label: 'calls'
                    });
                });
            });

            // Run call graph analysis
            const callAnalyzer = new CallGraphAnalyzer(ast, document);
            const callRelations = callAnalyzer.analyze();

            // Add call graph nodes and edges
            const functionNodes = new Set<string>();
            callRelations.forEach((call: CallRelation) => {
                // Add caller node if not exists
                if (!functionNodes.has(call.caller)) {
                    nodes.push({
                        id: `func_${call.caller}`,
                        label: call.caller,
                        type: 'method',
                        metadata: {
                            isFunction: true
                        }
                    });
                    functionNodes.add(call.caller);
                }

                // Add callee node if not exists
                if (!functionNodes.has(call.callee)) {
                    nodes.push({
                        id: `func_${call.callee}`,
                        label: call.callee,
                        type: 'method',
                        metadata: {
                            isFunction: true
                        }
                    });
                    functionNodes.add(call.callee);
                }

                // Add call edge
                edges.push({
                    source: `func_${call.caller}`,
                    target: `func_${call.callee}`,
                    type: 'calls',
                    label: call.isRecursive ? 'recursive call' : 'calls',
                    metadata: {
                        isRecursive: call.isRecursive,
                        isTainted: call.isTainted,
                        arguments: call.arguments
                    }
                });
            });

            // Run conditional path analysis
            const conditionalAnalyzer = new ConditionalPathAnalyzer(ast, document);
            const conditions = conditionalAnalyzer.analyze();

            // Add condition nodes
            conditions.forEach((condition: Condition, index: number) => {
                const condNodeId = `cond_${condition.type}_${condition.line}_${condition.column}`;
                nodes.push({
                    id: condNodeId,
                    label: `${condition.type}: ${condition.expression.substring(0, 30)}`,
                    type: 'method',
                    metadata: {
                        conditionType: condition.type,
                        expression: condition.expression,
                        branches: condition.branches.length
                    }
                });
            });

        } catch (error: any) {
            console.error('Error in data flow analysis:', error);
            // Return simplified graph on error
            const sources = ['$_GET', '$_POST', '$_COOKIE', '$_REQUEST'];
            const sinks = ['eval', 'system', 'exec', 'unserialize'];

            sources.forEach(source => {
                nodes.push({
                    id: source,
                    label: source,
                    type: 'source'
                });
            });

            sinks.forEach(sink => {
                nodes.push({
                    id: sink,
                    label: sink + '()',
                    type: 'sink'
                });
            });
        }

        return { nodes, edges };
    }

    public buildAttackChainGraph(attackChains: any[]): CodeGraph {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];

        // Build graph from attack chains
        attackChains.forEach((chain, chainIndex) => {
            if (chain.steps && Array.isArray(chain.steps)) {
                chain.steps.forEach((step: any, stepIndex: number) => {
                    const nodeId = `chain${chainIndex}_step${stepIndex}`;
                    nodes.push({
                        id: nodeId,
                        label: step.type || step.description || 'Step',
                        type: 'sink'
                    });

                    // Connect to previous step
                    if (stepIndex > 0) {
                        edges.push({
                            source: `chain${chainIndex}_step${stepIndex - 1}`,
                            target: nodeId,
                            type: 'dataflow',
                            label: 'leads to'
                        });
                    }
                });
            }
        });

        return { nodes, edges };
    }

    private isMagicMethod(name: string): boolean {
        const magicMethods = ['__construct', '__destruct', '__call', '__callStatic',
            '__get', '__set', '__isset', '__unset', '__sleep', '__wakeup',
            '__toString', '__invoke', '__set_state', '__clone', '__debugInfo'];
        return magicMethods.includes(name);
    }

    private updateGraph(graph: CodeGraph) {
        if (this._view) {
            this._view.webview.postMessage({
                type: 'updateGraph',
                graph: graph
            });
        }
    }

    private handleNodeClick(nodeId: string) {
        vscode.window.showInformationMessage(`Clicked node: ${nodeId}`);
    }

    private getHtmlContent(webview: vscode.Webview): string {
        return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Code Graph</title>
    <style>
        body {
            padding: 0;
            margin: 0;
            overflow: hidden;
        }
        #graph {
            width: 100vw;
            height: 100vh;
            background-color: var(--vscode-editor-background);
            color: var(--vscode-editor-foreground);
        }
        .node {
            cursor: pointer;
        }
        .node.class { fill: #4a9eff; }
        .node.method { fill: #6cbc6c; }
        .node.magic { fill: #ff6b6b; }
        .node.source { fill: #ff9f40; }
        .node.sink { fill: #dc3545; }
        .edge { stroke: var(--vscode-editor-foreground); stroke-width: 1; }
        .controls {
            position: absolute;
            top: 10px;
            right: 10px;
            background: var(--vscode-editor-background);
            padding: 10px;
            border: 1px solid var(--vscode-editor-foreground);
        }
        button {
            margin: 5px;
            padding: 5px 10px;
            background: var(--vscode-button-background);
            color: var(--vscode-button-foreground);
            border: none;
            cursor: pointer;
        }
    </style>
</head>
<body>
    <div id="graph">
        <svg width="100%" height="100%" id="svg"></svg>
    </div>
    <div class="controls">
        <button onclick="zoomIn()">+</button>
        <button onclick="zoomOut()">-</button>
        <button onclick="resetZoom()">Reset</button>
    </div>
    <script>
        const vscode = acquireVsCodeApi();
        let currentGraph = { nodes: [], edges: [] };
        let scale = 1;
        let translateX = 0;
        let translateY = 0;

        window.addEventListener('message', event => {
            const message = event.data;
            switch (message.type) {
                case 'updateGraph':
                    currentGraph = message.graph;
                    renderGraph();
                    break;
                case 'highlightPaths':
                    highlightPaths(message.paths);
                    break;
            }
        });

        function renderGraph() {
            const svg = document.getElementById('svg');
            svg.innerHTML = '';

            const width = svg.clientWidth;
            const height = svg.clientHeight;

            // Simple force-directed layout simulation
            const nodes = currentGraph.nodes.map((n, i) => ({
                ...n,
                x: Math.random() * (width - 100) + 50,
                y: Math.random() * (height - 100) + 50
            }));

            const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
            g.setAttribute('transform', \`translate(\${translateX}, \${translateY}) scale(\${scale})\`);

            // Draw edges
            currentGraph.edges.forEach(edge => {
                const source = nodes.find(n => n.id === edge.source);
                const target = nodes.find(n => n.id === edge.target);
                if (source && target) {
                    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
                    line.setAttribute('x1', source.x);
                    line.setAttribute('y1', source.y);
                    line.setAttribute('x2', target.x);
                    line.setAttribute('y2', target.y);
                    line.setAttribute('class', 'edge');
                    g.appendChild(line);
                }
            });

            // Draw nodes
            nodes.forEach(node => {
                const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
                circle.setAttribute('cx', node.x);
                circle.setAttribute('cy', node.y);
                circle.setAttribute('r', 20);
                circle.setAttribute('class', \`node \${node.type}\`);
                circle.onclick = () => {
                    vscode.postMessage({ type: 'nodeClicked', nodeId: node.id });
                };
                g.appendChild(circle);

                const text = document.createElementNS('http://www.w3.org/2000/svg', 'text');
                text.setAttribute('x', node.x);
                text.setAttribute('y', node.y + 30);
                text.setAttribute('text-anchor', 'middle');
                text.setAttribute('fill', 'var(--vscode-editor-foreground)');
                text.textContent = node.label;
                g.appendChild(text);
            });

            svg.appendChild(g);
        }

        function zoomIn() {
            scale *= 1.2;
            renderGraph();
        }

        function zoomOut() {
            scale /= 1.2;
            renderGraph();
        }

        function resetZoom() {
            scale = 1;
            translateX = 0;
            translateY = 0;
            renderGraph();
        }

        function highlightPaths(paths) {
            // TODO: Implement path highlighting
        }
    </script>
</body>
</html>`;
    }
}
