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
            
            // 构造更详细的标签
            let label = 'unserialize(';
            if (entry.paramSource && entry.paramName) {
                label += `${entry.paramSource}['${entry.paramName}']`;
            } else if (entry.paramName) {
                label += `$${entry.paramName}`;
            } else {
                label += '...';
            }
            label += ')';
            
            nodes.push({
                id: entryId,
                label: label,
                type: 'entry',
                metadata: {
                    line: entry.line,
                    column: entry.column,
                    description: '反序列化入口点 - POP链起点',
                    paramName: entry.paramName,
                    paramSource: entry.paramSource
                }
            });
        });

        // 2. Add all class nodes with inheritance relationships and properties
        const classes = phpAnalyzer.getAllClasses();
        const classMap = new Map<string, any>();
        
        for (const classNode of classes) {
            const className = classNode.name?.name || 'Unknown';
            classMap.set(className, classNode);
            
            const classId = `class_${className}`;
            if (!nodeIds.has(classId)) {
                nodeIds.add(classId);
                
                // 统计类的属性和方法数量
                let propertyCount = 0;
                let methodCount = 0;
                let hasMagicMethods = false;
                const magicMethodsList: string[] = [];
                
                if (classNode.body) {
                    for (const member of classNode.body) {
                        if (member.kind === 'propertystatement') {
                            propertyCount += (member.properties?.length || 1);
                        } else if (member.kind === 'method') {
                            methodCount++;
                            const methodName = member.name?.name || member.name || '';
                            if (methodName.startsWith('__')) {
                                hasMagicMethods = true;
                                magicMethodsList.push(methodName);
                            }
                        }
                    }
                }
                
                nodes.push({
                    id: classId,
                    label: className,
                    type: 'class',
                    metadata: {
                        line: phpAnalyzer.getNodeLocation(classNode)?.line,
                        extends: classNode.extends?.name || null,
                        implements: classNode.implements?.map((i: any) => i.name) || [],
                        properties: propertyCount,
                        methods: methodCount,
                        hasMagicMethods: hasMagicMethods,
                        magicMethods: magicMethodsList
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

            // 3. Add class properties (NEW!)
            if (classNode.body) {
                for (const member of classNode.body) {
                    if (member.kind === 'propertystatement') {
                        // Handle property declarations
                        const properties = member.properties || [];
                        for (const prop of properties) {
                            const propName = prop.name?.name || prop.name || 'unknown';
                            const propId = `prop_${className}_${propName}`;
                            const visibility = member.visibility || 'public';
                            
                            if (!nodeIds.has(propId)) {
                                nodeIds.add(propId);
                                nodes.push({
                                    id: propId,
                                    label: `$${propName}`,
                                    type: 'property',
                                    metadata: {
                                        className: className,
                                        visibility: visibility,
                                        line: phpAnalyzer.getNodeLocation(prop)?.line
                                    }
                                });
                            }

                            edges.push({
                                source: classId,
                                target: propId,
                                type: 'contains',
                                label: visibility
                            });
                        }
                    }
                }
            }
        }

        // 4. Add method nodes and analyze magic method chains
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
                    
                    // 提取方法参数
                    const parameters = (member.arguments || []).map((arg: any) => {
                        const name = arg.name?.name || arg.name || 'unknown';
                        const type = arg.type?.name || '';
                        return type ? `${type} $${name}` : `$${name}`;
                    });
                    
                    // 分析方法体中的危险调用
                    const dangerousCalls: string[] = [];
                    const triggers: string[] = [];
                    
                    if (member.body?.children) {
                        this.traverseForDangerousCalls(member.body.children, dangerousCalls, triggers);
                    }
                    
                    if (!nodeIds.has(methodId)) {
                        nodeIds.add(methodId);
                        nodes.push({
                            id: methodId,
                            label: `${className}::${methodName}`,
                            type: isMagic ? 'magic' : 'method',
                            metadata: {
                                line: phpAnalyzer.getNodeLocation(member)?.line,
                                isMagic: isMagic,
                                visibility: member.visibility || 'public',
                                parameters: parameters,
                                dangerousCalls: dangerousCalls,
                                triggers: triggers,
                                description: isMagic ? this.getMagicMethodDescription(methodName) : ''
                            }
                        });
                    }

                    edges.push({
                        source: classId,
                        target: methodId,
                        type: 'contains'
                    });

                    // Connect unserialize to __wakeup and __destruct
                    if ((methodName === '__wakeup' || methodName === '__destruct') && unserializeEntries.length > 0) {
                        unserializeEntries.forEach((entry, index) => {
                            const triggerLabel = methodName === '__wakeup' ? 'auto triggers' : 'triggers on destroy';
                            edges.push({
                                source: `entry_unserialize_${index}`,
                                target: methodId,
                                type: 'triggers',
                                label: triggerLabel
                            });
                        });
                    }

                    // 5. Analyze method body for property usage and magic method triggers
                    this.analyzeMethodBody(member, className, methodName, methodId, nodes, edges, nodeIds, phpAnalyzer);
                }
            }
        }

        // 6. Add magic method trigger chains from analyzer
        for (const chain of magicChains) {
            const parts = chain.entryPoint.split('::');
            const entryClassName = parts[0];
            const entryMethodName = parts[1];
            const entryNodeId = `method_${entryClassName}_${entryMethodName}`;

            for (const trigger of chain.chain) {
                if (trigger.methodName.startsWith('__')) {
                    const triggerId = `trigger_${trigger.className}_${trigger.methodName}_${trigger.line}`;
                    
                    if (!nodeIds.has(triggerId)) {
                        nodeIds.add(triggerId);
                        nodes.push({
                            id: triggerId,
                            label: `→ ${trigger.methodName}`,
                            type: 'magic',
                            metadata: {
                                line: trigger.line,
                                column: trigger.column,
                                triggeredBy: trigger.triggeredBy
                            }
                        });
                    }

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

            // Add property flow nodes
            for (const flow of chain.propertyFlows) {
                const propId = `flow_${flow.fromClass}_${flow.propertyName}_${flow.line}`;
                
                if (!nodeIds.has(propId)) {
                    nodeIds.add(propId);
                    nodes.push({
                        id: propId,
                        label: `$this->${flow.propertyName}`,
                        type: 'property',
                        metadata: {
                            line: flow.line,
                            usedAs: flow.usedAs,
                            toVariable: flow.toVariable
                        }
                    });
                }

                const classNodeId = `class_${flow.fromClass}`;
                if (nodeIds.has(classNodeId)) {
                    edges.push({
                        source: classNodeId,
                        target: propId,
                        type: 'dataflow',
                        label: `→ $${flow.toVariable}`
                    });
                }

                if (nodeIds.has(entryNodeId)) {
                    edges.push({
                        source: propId,
                        target: entryNodeId,
                        type: 'dataflow',
                        label: `used as ${flow.usedAs}`
                    });
                }
            }

            // Add dangerous sink nodes
            for (const sink of chain.dangerousSinks) {
                const sinkId = `sink_${sink}_${chain.entryPoint}`;
                
                if (!nodeIds.has(sinkId)) {
                    nodeIds.add(sinkId);
                    nodes.push({
                        id: sinkId,
                        label: `⚠ ${sink}()`,
                        type: 'sink',
                        metadata: {
                            dangerous: true,
                            description: '危险函数调用'
                        }
                    });
                }

                if (nodeIds.has(entryNodeId)) {
                    edges.push({
                        source: entryNodeId,
                        target: sinkId,
                        type: 'calls',
                        label: 'calls dangerous'
                    });
                }
            }
        }

        return { nodes, edges };
    }

    /**
     * Analyze method body for property usage and potential magic method triggers
     */
    private analyzeMethodBody(
        methodNode: any, 
        className: string, 
        methodName: string, 
        methodId: string,
        nodes: GraphNode[], 
        edges: GraphEdge[], 
        nodeIds: Set<string>,
        phpAnalyzer: PHPAnalyzer
    ): void {
        if (!methodNode.body) return;

        const propertyUsages = new Map<string, { read: boolean; write: boolean; asCallable: boolean; asObject: boolean }>();

        phpAnalyzer.traverse(methodNode.body, (node: any) => {
            // Track property lookups: $this->property
            if (node.kind === 'propertylookup' && node.what?.kind === 'variable' && node.what?.name === 'this') {
                const propName = node.offset?.name || '';
                if (propName) {
                    if (!propertyUsages.has(propName)) {
                        propertyUsages.set(propName, { read: false, write: false, asCallable: false, asObject: false });
                    }
                    propertyUsages.get(propName)!.read = true;
                }
            }

            // Track callable usage: ($this->property)($args) - triggers __invoke
            if (node.kind === 'call' && node.what?.kind === 'propertylookup') {
                const propName = node.what.offset?.name || '';
                if (propName && node.what.what?.name === 'this') {
                    if (!propertyUsages.has(propName)) {
                        propertyUsages.set(propName, { read: false, write: false, asCallable: false, asObject: false });
                    }
                    propertyUsages.get(propName)!.asCallable = true;

                    // Add __invoke trigger edge
                    const invokeTriggerId = `invoke_trigger_${className}_${methodName}_${propName}`;
                    if (!nodeIds.has(invokeTriggerId)) {
                        nodeIds.add(invokeTriggerId);
                        nodes.push({
                            id: invokeTriggerId,
                            label: `→ __invoke`,
                            type: 'magic',
                            metadata: {
                                triggeredBy: `($this->${propName})(...)`,
                                description: '作为函数调用触发 __invoke'
                            }
                        });
                        edges.push({
                            source: methodId,
                            target: invokeTriggerId,
                            type: 'triggers',
                            label: `$this->${propName}()`
                        });
                    }
                }
            }

            // Track property write on object: $var->prop = value - triggers __set
            if (node.kind === 'assign' && node.left?.kind === 'propertylookup') {
                const objectVar = node.left.what?.name || '';
                const propName = node.left.offset?.name || '';
                if (objectVar && propName && objectVar !== 'this') {
                    const setTriggerId = `set_trigger_${className}_${methodName}_${objectVar}_${propName}`;
                    if (!nodeIds.has(setTriggerId)) {
                        nodeIds.add(setTriggerId);
                        nodes.push({
                            id: setTriggerId,
                            label: `→ __set`,
                            type: 'magic',
                            metadata: {
                                triggeredBy: `$${objectVar}->${propName} = ...`,
                                description: '属性赋值触发 __set'
                            }
                        });
                        edges.push({
                            source: methodId,
                            target: setTriggerId,
                            type: 'triggers',
                            label: `$${objectVar}->${propName}=`
                        });
                    }
                }
            }

            // Track dynamic method call: $var->$method() - triggers __call
            if (node.kind === 'call' && node.what?.kind === 'propertylookup' && node.what.offset?.kind === 'variable') {
                const callTriggerId = `call_trigger_${className}_${methodName}`;
                if (!nodeIds.has(callTriggerId)) {
                    nodeIds.add(callTriggerId);
                    nodes.push({
                        id: callTriggerId,
                        label: `→ dynamic call`,
                        type: 'magic',
                        metadata: {
                            description: '动态方法调用'
                        }
                    });
                    edges.push({
                        source: methodId,
                        target: callTriggerId,
                        type: 'triggers',
                        label: 'dynamic'
                    });
                }
            }
        });

        // Add property usage edges
        for (const [propName, usage] of propertyUsages) {
            const propId = `prop_${className}_${propName}`;
            if (nodeIds.has(propId)) {
                let label = '';
                if (usage.asCallable) label = 'as callable';
                else if (usage.asObject) label = 'as object';
                else if (usage.read) label = 'reads';
                
                if (label) {
                    edges.push({
                        source: methodId,
                        target: propId,
                        type: 'dataflow',
                        label: label
                    });
                }
            }
        }
    }

    /**
     * 遍历方法体查找危险调用和触发器
     */
    private traverseForDangerousCalls(nodes: any[], dangerousCalls: string[], triggers: string[]): void {
        const dangerousFunctions = [
            'system', 'exec', 'shell_exec', 'passthru', 'popen', 'proc_open',
            'eval', 'assert', 'preg_replace', 'create_function',
            'file_get_contents', 'file_put_contents', 'fwrite', 'file',
            'include', 'include_once', 'require', 'require_once',
            'unserialize', 'call_user_func', 'call_user_func_array',
            'array_map', 'array_filter', 'usort', 'uasort'
        ];
        
        const traverseNode = (node: any) => {
            if (!node) return;
            
            // 检测函数调用
            if (node.kind === 'call') {
                const funcName = node.what?.name || '';
                
                // 直接危险函数调用
                if (dangerousFunctions.includes(funcName.toLowerCase())) {
                    dangerousCalls.push(funcName);
                }
                
                // 动态函数调用 ($func)()
                if (node.what?.kind === 'variable') {
                    dangerousCalls.push(`($${node.what.name})()`);
                }
                
                // 动态函数调用 ($this->func)()
                if (node.what?.kind === 'propertylookup') {
                    const propName = node.what?.offset?.name || 'prop';
                    dangerousCalls.push(`($this->${propName})()`);
                }
            }
            
            // 检测对象方法调用触发器
            if (node.kind === 'call' && node.what?.kind === 'propertylookup') {
                const obj = node.what.what;
                const method = node.what.offset;
                
                if (obj?.kind === 'variable' && obj.name === 'this' && method?.kind === 'identifier') {
                    triggers.push(`调用 $this->${method.name}()`);
                } else if (obj?.kind === 'propertylookup' && method?.kind === 'identifier') {
                    triggers.push(`调用 $this->obj->${method.name}()`);
                }
            }
            
            // 递归遍历
            for (const key of Object.keys(node)) {
                const child = node[key];
                if (Array.isArray(child)) {
                    child.forEach(c => traverseNode(c));
                } else if (child && typeof child === 'object' && child.kind) {
                    traverseNode(child);
                }
            }
        };
        
        nodes.forEach(n => traverseNode(n));
    }

    /**
     * Get description for magic methods
     */
    private getMagicMethodDescription(methodName: string): string {
        const descriptions: Record<string, string> = {
            '__construct': '构造函数',
            '__destruct': '析构函数 - 对象销毁时自动调用',
            '__wakeup': '反序列化时自动调用',
            '__sleep': '序列化时调用',
            '__toString': '对象转字符串时调用',
            '__invoke': '对象作为函数调用时触发',
            '__call': '调用不存在的方法时触发',
            '__callStatic': '调用不存在的静态方法时触发',
            '__get': '访问不存在的属性时触发',
            '__set': '设置不存在的属性时触发',
            '__isset': '检查不存在的属性时触发',
            '__unset': '删除不存在的属性时触发',
            '__clone': '克隆对象时调用',
            '__debugInfo': 'var_dump时调用'
        };
        return descriptions[methodName] || '';
    }

    public buildInheritanceGraph(ast: any, document: vscode.TextDocument): CodeGraph {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const nodeIds = new Set<string>();

        const phpAnalyzer = new PHPAnalyzer('');
        phpAnalyzer['ast'] = ast;
        const classes = phpAnalyzer.getAllClasses();

        for (const classNode of classes) {
            const className = classNode.name?.name || 'Unknown';
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
                
                if (!nodeIds.has(parentId)) {
                    nodeIds.add(parentId);
                    nodes.push({
                        id: parentId,
                        label: parentName,
                        type: 'class',
                        metadata: {
                            isParent: true
                        }
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
                            label: `<<interface>> ${ifaceName}`,
                            type: 'class',
                            metadata: {
                                isInterface: true
                            }
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

            // Add class properties
            if (classNode.body) {
                for (const member of classNode.body) {
                    if (member.kind === 'propertystatement') {
                        const properties = member.properties || [];
                        for (const prop of properties) {
                            const propName = prop.name?.name || prop.name || 'unknown';
                            const propId = `prop_${className}_${propName}`;
                            const visibility = member.visibility || 'public';
                            
                            if (!nodeIds.has(propId)) {
                                nodeIds.add(propId);
                                nodes.push({
                                    id: propId,
                                    label: `${visibility} $${propName}`,
                                    type: 'property',
                                    metadata: {
                                        className: className,
                                        visibility: visibility
                                    }
                                });
                            }

                            edges.push({
                                source: classId,
                                target: propId,
                                type: 'contains'
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
        const nodeIds = new Set<string>();

        const phpAnalyzer = new PHPAnalyzer('');
        phpAnalyzer['ast'] = ast;

        // 1. Find all user input sources (superglobals)
        const sources = ['$_GET', '$_POST', '$_COOKIE', '$_REQUEST', '$_FILES', '$_SERVER'];
        const foundSources: { name: string; line: number }[] = [];

        phpAnalyzer.traverse(ast, (node: any) => {
            if (node.kind === 'offsetlookup' && node.what?.kind === 'variable') {
                const varName = '$' + (node.what.name || '');
                if (sources.includes(varName)) {
                    const loc = phpAnalyzer.getNodeLocation(node);
                    foundSources.push({ name: varName, line: loc?.line || 0 });
                }
            }
        });

        // Add source nodes
        foundSources.forEach((src, index) => {
            const srcId = `source_${src.name}_${index}`;
            if (!nodeIds.has(srcId)) {
                nodeIds.add(srcId);
                nodes.push({
                    id: srcId,
                    label: `${src.name}[...]`,
                    type: 'source',
                    metadata: {
                        line: src.line,
                        description: '用户输入源'
                    }
                });
            }
        });

        // 2. Find all dangerous sinks
        const dangerousFuncs = ['eval', 'system', 'exec', 'passthru', 'shell_exec', 
                               'unserialize', 'include', 'require', 'call_user_func'];
        const foundSinks: { name: string; line: number }[] = [];

        phpAnalyzer.traverse(ast, (node: any) => {
            if (node.kind === 'call' && node.what?.name) {
                const funcName = node.what.name;
                if (dangerousFuncs.includes(funcName)) {
                    const loc = phpAnalyzer.getNodeLocation(node);
                    foundSinks.push({ name: funcName, line: loc?.line || 0 });
                }
            }
        });

        // Add sink nodes
        foundSinks.forEach((sink, index) => {
            const sinkId = `sink_${sink.name}_${index}`;
            if (!nodeIds.has(sinkId)) {
                nodeIds.add(sinkId);
                nodes.push({
                    id: sinkId,
                    label: `⚠ ${sink.name}()`,
                    type: 'sink',
                    metadata: {
                        line: sink.line,
                        dangerous: true
                    }
                });
            }
        });

        // 3. Track variable assignments and data flow
        const variableFlows: { from: string; to: string; line: number }[] = [];

        phpAnalyzer.traverse(ast, (node: any) => {
            if (node.kind === 'assign') {
                const leftVar = node.left?.name ? `$${node.left.name}` : null;
                let rightSource = null;

                // Check if right side is a source
                if (node.right?.kind === 'offsetlookup' && node.right.what?.kind === 'variable') {
                    const varName = '$' + (node.right.what.name || '');
                    if (sources.includes(varName)) {
                        rightSource = varName;
                    }
                }

                if (leftVar && rightSource) {
                    const loc = phpAnalyzer.getNodeLocation(node);
                    variableFlows.push({ from: rightSource, to: leftVar, line: loc?.line || 0 });

                    // Add variable node
                    const varId = `var_${leftVar}_${loc?.line || 0}`;
                    if (!nodeIds.has(varId)) {
                        nodeIds.add(varId);
                        nodes.push({
                            id: varId,
                            label: leftVar,
                            type: 'property',
                            metadata: {
                                line: loc?.line,
                                tainted: true
                            }
                        });
                    }

                    // Connect source to variable
                    const srcId = foundSources.findIndex(s => s.name === rightSource);
                    if (srcId >= 0) {
                        edges.push({
                            source: `source_${rightSource}_${srcId}`,
                            target: varId,
                            type: 'dataflow',
                            label: 'assigns'
                        });
                    }
                }
            }
        });

        // 4. Connect variables to sinks
        foundSinks.forEach((sink, sinkIndex) => {
            const sinkId = `sink_${sink.name}_${sinkIndex}`;
            
            // For unserialize specifically
            if (sink.name === 'unserialize') {
                foundSources.forEach((src, srcIndex) => {
                    edges.push({
                        source: `source_${src.name}_${srcIndex}`,
                        target: sinkId,
                        type: 'dataflow',
                        label: '⚠ tainted data',
                        metadata: {
                            severity: 'critical',
                            vulnerabilityType: 'Insecure Deserialization'
                        }
                    });
                });
            }
        });

        // 5. Add magic method chain for POP
        const magicAnalyzer = new MagicMethodChainAnalyzer(ast, document);
        const chains = magicAnalyzer.traceChains();

        for (const chain of chains) {
            const entryId = `chain_entry_${chain.entryPoint}`;
            if (!nodeIds.has(entryId)) {
                nodeIds.add(entryId);
                nodes.push({
                    id: entryId,
                    label: chain.entryPoint,
                    type: 'magic',
                    metadata: {
                        entryType: chain.entryType
                    }
                });
            }

            // Connect unserialize to chain entry
            foundSinks.forEach((sink, index) => {
                if (sink.name === 'unserialize') {
                    edges.push({
                        source: `sink_${sink.name}_${index}`,
                        target: entryId,
                        type: 'triggers',
                        label: 'triggers'
                    });
                }
            });

            // Add chain steps
            for (const trigger of chain.chain) {
                const triggerId = `chain_${trigger.className}_${trigger.methodName}`;
                if (!nodeIds.has(triggerId)) {
                    nodeIds.add(triggerId);
                    nodes.push({
                        id: triggerId,
                        label: `${trigger.className}::${trigger.methodName}`,
                        type: 'magic',
                        metadata: {
                            triggeredBy: trigger.triggeredBy
                        }
                    });
                }

                edges.push({
                    source: entryId,
                    target: triggerId,
                    type: 'triggers',
                    label: trigger.triggeredBy
                });
            }
        }

        return { nodes, edges };
    }

    public buildAttackChainGraph(attackChains: any[]): CodeGraph {
        const nodes: GraphNode[] = [];
        const edges: GraphEdge[] = [];
        const nodeIds = new Set<string>();

        // Add entry point
        const entryId = 'attack_entry';
        nodeIds.add(entryId);
        nodes.push({
            id: entryId,
            label: '⚡ unserialize()',
            type: 'entry',
            metadata: {
                description: 'Attack entry point'
            }
        });

        // Build graph from attack chains
        attackChains.forEach((chain, chainIndex) => {
            const chainEntryId = `chain_${chainIndex}_entry`;
            
            // Add chain entry node
            if (chain.entryPoint) {
                if (!nodeIds.has(chainEntryId)) {
                    nodeIds.add(chainEntryId);
                    nodes.push({
                        id: chainEntryId,
                        label: chain.entryPoint,
                        type: 'magic',
                        metadata: {
                            exploitability: chain.exploitability,
                            description: chain.description
                        }
                    });
                }

                edges.push({
                    source: entryId,
                    target: chainEntryId,
                    type: 'triggers',
                    label: 'triggers'
                });
            }

            // Add chain steps
            if (chain.steps && Array.isArray(chain.steps)) {
                let prevNodeId = chainEntryId;
                
                chain.steps.forEach((step: any, stepIndex: number) => {
                    const stepId = `chain${chainIndex}_step${stepIndex}`;
                    
                    if (!nodeIds.has(stepId)) {
                        nodeIds.add(stepId);
                        nodes.push({
                            id: stepId,
                            label: step.operation || step.methodName || 'Step',
                            type: step.methodName?.startsWith('__') ? 'magic' : 'method',
                            metadata: {
                                className: step.className,
                                operation: step.operation
                            }
                        });
                    }

                    edges.push({
                        source: prevNodeId,
                        target: stepId,
                        type: 'calls',
                        label: 'calls'
                    });

                    prevNodeId = stepId;
                });

                // Add sink if exists
                if (chain.sink) {
                    const sinkId = `chain${chainIndex}_sink`;
                    if (!nodeIds.has(sinkId)) {
                        nodeIds.add(sinkId);
                        nodes.push({
                            id: sinkId,
                            label: `⚠ ${chain.sink}()`,
                            type: 'sink',
                            metadata: {
                                dangerous: true
                            }
                        });
                    }

                    edges.push({
                        source: prevNodeId,
                        target: sinkId,
                        type: 'calls',
                        label: 'reaches'
                    });
                }
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
