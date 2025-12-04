import * as vscode from 'vscode';
import { PHPAnalyzer } from './analyzers/phpAnalyzer';
import { VariableTracker } from './analyzers/variableTracker';
import { ClassAnalyzer } from './analyzers/classAnalyzer';
import { MagicMethodDetector } from './analyzers/magicMethodDetector';
import { SerializationAnalyzer } from './analyzers/serializationAnalyzer';
import { POPChainDetector, POPChainResult, ChainStep } from './analyzers/popChainDetector';
import { AttackChainAnalyzer } from './analyzers/attackChainAnalyzer';
import { VulnerabilityScanner } from './analyzers/vulnerabilityScanner';
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

    // Start the graph server
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

    // Initialize providers
    const analysisResultsProvider = new AnalysisResultsProvider();
    const codeGraphProvider = new CodeGraphProvider(context.extensionUri);

    // Register tree view
    vscode.window.registerTreeDataProvider('phpAnalysisResults', analysisResultsProvider);
    
    // Register webview provider (keep for backward compatibility)
    vscode.window.registerWebviewViewProvider('phpCodeGraph', codeGraphProvider);

    // Register commands
    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.trackVariableFlow', async () => {
            await trackVariableFlow(analysisResultsProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.analyzeClassRelations', async () => {
            await analyzeClassRelations(analysisResultsProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.showMagicMethods', async () => {
            await showMagicMethods(analysisResultsProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.findSerializationPoints', async () => {
            await findSerializationPoints(analysisResultsProvider);
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
        vscode.commands.registerCommand('phpAnalyzer.analyzeAttackChains', async () => {
            await analyzeAttackChains(analysisResultsProvider, codeGraphProvider);
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
        vscode.commands.registerCommand('phpAnalyzer.showInheritanceGraph', async () => {
            await showInheritanceGraph(codeGraphProvider);
        })
    );

    context.subscriptions.push(
        vscode.commands.registerCommand('phpAnalyzer.showDataFlowGraph', async () => {
            await showDataFlowGraph(codeGraphProvider);
        })
    );

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

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        const config = vscode.workspace.getConfiguration('phpAnalyzer');
        const maxDepth = config.get<number>('maxChainDepth') || 5;
        
        const attackAnalyzer = new AttackChainAnalyzer(analyzer.getAST(), maxDepth);
        const chains = attackAnalyzer.analyzeAttackChains(docInfo.document);

        if (chains.length === 0) {
            vscode.window.showWarningMessage('No attack chains found. Run "Analyze Attack Chains" first.');
            return;
        }

        const generator = new PayloadGenerator();
        const payload = await generator.generatePayload(chains, docInfo.document);
        
        if (payload) {
            const doc = await vscode.workspace.openTextDocument({
                content: payload,
                language: 'php'
            });
            await vscode.window.showTextDocument(doc);
        }
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error generating payload: ${error.message}`);
    }
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
