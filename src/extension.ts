import * as vscode from 'vscode';
import { PHPAnalyzer } from './analyzers/phpAnalyzer';
import { VariableTracker } from './analyzers/variableTracker';
import { ClassAnalyzer } from './analyzers/classAnalyzer';
import { MagicMethodDetector } from './analyzers/magicMethodDetector';
import { SerializationAnalyzer } from './analyzers/serializationAnalyzer';
import { POPChainDetector } from './analyzers/popChainDetector';
import { AttackChainAnalyzer } from './analyzers/attackChainAnalyzer';
import { VulnerabilityScanner } from './analyzers/vulnerabilityScanner';
import { AnalysisResultsProvider } from './providers/analysisResultsProvider';
import { CodeGraphProvider } from './providers/codeGraphProvider';
import { PayloadGenerator } from './utils/payloadGenerator';

export function activate(context: vscode.ExtensionContext) {
    console.log('PHP Code Analyzer for CTF is now active');

    // Initialize providers
    const analysisResultsProvider = new AnalysisResultsProvider();
    const codeGraphProvider = new CodeGraphProvider(context.extensionUri);

    // Register tree view
    vscode.window.registerTreeDataProvider('phpAnalysisResults', analysisResultsProvider);
    
    // Register webview provider
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
    if (!docInfo) return;

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
    if (!docInfo) return;

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
    if (!docInfo) return;

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
    if (!docInfo) return;

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
    if (!docInfo) return;

    try {
        const config = vscode.workspace.getConfiguration('phpAnalyzer');
        const maxDepth = config.get<number>('maxChainDepth') || 5;

        const analyzer = new PHPAnalyzer(docInfo.text);
        const detector = new POPChainDetector(analyzer.getAST(), maxDepth);
        const results = detector.findPOPChains(docInfo.document);
        
        provider.updateResults('POP Chains', results);
        vscode.window.showInformationMessage(`Found ${results.length} potential POP chains`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error finding POP chains: ${error.message}`);
    }
}

async function fullSecurityAnalysis(provider: AnalysisResultsProvider, graphProvider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) return;

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
            const popDetector = new POPChainDetector(ast, maxDepth);
            const popResults = popDetector.findPOPChains(docInfo.document);

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
                await graphProvider.showCodeGraph(ast, docInfo.document);
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
    if (!docInfo) return;

    try {
        const config = vscode.workspace.getConfiguration('phpAnalyzer');
        const maxDepth = config.get<number>('maxChainDepth') || 5;

        const analyzer = new PHPAnalyzer(docInfo.text);
        const attackAnalyzer = new AttackChainAnalyzer(analyzer.getAST(), maxDepth);
        const results = attackAnalyzer.analyzeAttackChains(docInfo.document);
        
        provider.updateResults('Attack Chains', results);
        
        // Highlight attack paths in graph
        await graphProvider.highlightAttackPaths(results);
        
        vscode.window.showInformationMessage(`Found ${results.length} attack chains`);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error analyzing attack chains: ${error.message}`);
    }
}

async function scanVulnerabilities(provider: AnalysisResultsProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) return;

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
    if (!docInfo) return;

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
    if (!docInfo) return;

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        await provider.showCodeGraph(analyzer.getAST(), docInfo.document);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error showing code graph: ${error.message}`);
    }
}

async function showInheritanceGraph(provider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) return;

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        await provider.showInheritanceGraph(analyzer.getAST(), docInfo.document);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error showing inheritance graph: ${error.message}`);
    }
}

async function showDataFlowGraph(provider: CodeGraphProvider) {
    const docInfo = await getActivePhpDocument();
    if (!docInfo) return;

    try {
        const analyzer = new PHPAnalyzer(docInfo.text);
        await provider.showDataFlowGraph(analyzer.getAST(), docInfo.document);
    } catch (error: any) {
        vscode.window.showErrorMessage(`Error showing data flow graph: ${error.message}`);
    }
}

export function deactivate() {}
